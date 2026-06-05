// Bill of materials + connector classification + power runs.
// Connector classifier ported from the original bundle's `ue(degree, dirs)`.

import { adjacency, buildGraph, Doc, Graph } from "./geometry";
import {
  BarConfig,
  barPrice,
  BarLength,
  CONNECTOR_PRICE,
  ConnectorType,
  CONNECTOR_ORDER,
  defaultBarConfig,
  MAX_WATTS_PER_RUN,
  POWER_PRICE,
  SYSTEM_BY_ID,
} from "./spec";

export interface NodeInfo {
  key: string;
  x: number;
  y: number;
  type: ConnectorType | null; // null = dangling end (degree 1) or isolated
  dirs: { x: number; y: number }[];
}

// classifyConnector(degree, unit-direction-vectors-to-neighbours)
export function classifyConnector(degree: number, dirs: { x: number; y: number }[]): ConnectorType | null {
  if (degree === 1) return null;
  if (degree === 2 && dirs.length === 2) {
    const dot = dirs[0].x * dirs[1].x + dirs[0].y * dirs[1].y;
    if (dot < -0.99) return "i"; // straight-through (180°)
    if (Math.abs(dot) < 0.01) return "l"; // right-angle (90°)
    return "v"; // angled two-way (e.g. 120°)
  }
  if (degree === 3) return "y";
  return "multi"; // 4-way+ == X
}

export function nodeInfos(g: Graph): Map<string, NodeInfo> {
  const adj = adjacency(g);
  const out = new Map<string, NodeInfo>();
  for (const n of g.nodes.values()) {
    const links = adj.get(n.key) ?? [];
    const dirs = links.map(({ edge }) => {
      const other = edge.from === n.key ? g.nodes.get(edge.to)! : g.nodes.get(edge.from)!;
      const dx = other.x - n.x,
        dy = other.y - n.y;
      const m = Math.hypot(dx, dy) || 1;
      return { x: dx / m, y: dy / m };
    });
    out.set(n.key, { key: n.key, x: n.x, y: n.y, type: classifyConnector(links.length, dirs), dirs });
  }
  return out;
}

export interface Point { x: number; y: number }
// A marker at a node, with a unit direction into the widest open gap between the
// bars there — so the icon can be offset off the tubes with a short leader.
export interface MarkerPoint { x: number; y: number; dx: number; dy: number }

// direction bisecting the largest angular gap between bars at a node
function openDir(dirs: { x: number; y: number }[]): { dx: number; dy: number } {
  if (dirs.length === 0) return { dx: 0, dy: -1 };
  if (dirs.length === 1) return { dx: -dirs[0].x, dy: -dirs[0].y };
  const angs = dirs.map((d) => Math.atan2(d.y, d.x)).sort((a, b) => a - b);
  let bestMid = 0, bestGap = -1;
  for (let i = 0; i < angs.length; i++) {
    const a = angs[i];
    const b = i + 1 < angs.length ? angs[i + 1] : angs[0] + Math.PI * 2;
    const gap = b - a;
    if (gap > bestGap) { bestGap = gap; bestMid = a + gap / 2; }
  }
  return { dx: Math.cos(bestMid), dy: Math.sin(bestMid) };
}

export interface SegmentGroup {
  systemId: string;
  label: string;
  segmentLengthMm: BarLength;
  count: number;
}

export interface PowerSummary {
  runs: number; // connected runs of bars
  totalWatts: number;
  powerInputs: number; // power supplies required (>=1 per run, capped at 420W each)
}

export interface Bom {
  segmentGroups: SegmentGroup[]; // bars by length
  connectorCounts: { type: ConnectorType; count: number; label: string }[];
  power: PowerSummary;
  estimatedPrice: number;
  totalSegments: number;
  totalConnectors: number;
  suspensionPoints: number; // cables for suspended mounting: one per junction + free end
  powerPoints: MarkerPoint[]; // where each power cord plugs in (world mm)
  hangerPoints: MarkerPoint[]; // where suspension cables attach (world mm)
}

// Connected components of active edges -> each is a power run (with its nodes).
function powerRuns(g: Graph, wattsPerBar: Record<BarLength, number>): { watts: number; nodes: string[] }[] {
  const adj = adjacency(g);
  const seen = new Set<string>();
  const runs: { watts: number; nodes: string[] }[] = [];
  for (const start of g.nodes.keys()) {
    if (seen.has(start)) continue;
    if (!adj.has(start)) {
      seen.add(start);
      continue;
    }
    // BFS over nodes; sum each edge once
    const stack = [start];
    seen.add(start);
    const nodes: string[] = [start];
    const edgeSeen = new Set<string>();
    let watts = 0;
    while (stack.length) {
      const cur = stack.pop()!;
      for (const { nbr, edge } of adj.get(cur) ?? []) {
        if (!edgeSeen.has(edge.key)) {
          edgeSeen.add(edge.key);
          watts += wattsPerBar[edge.len as BarLength] ?? 0;
        }
        if (!seen.has(nbr)) {
          seen.add(nbr);
          nodes.push(nbr);
          stack.push(nbr);
        }
      }
    }
    if (edgeSeen.size > 0) runs.push({ watts, nodes });
  }
  return runs;
}

// A power cord needs a free port. A bar end (degree 1) is already open; a fully
// used connector is not. So a cord placed on a connector upgrades it by one
// port (V->Y, I/L->T, Y/T->X).
const PORT_UPGRADE: Partial<Record<ConnectorType, ConnectorType>> = {
  v: "y", l: "t", i: "t", y: "multi", t: "multi",
};

const SQRT3 = Math.sqrt(3);

// Balanced anchor nodes: k-means partition of the actual nodes into n regions,
// each anchored at the node nearest its centroid. Clusters tile the real shape
// so the perimeter is covered (no empty-corner gaps), and load is balanced.
function balancedAnchors(keys: string[], P: (k: string) => Point, n: number): string[] {
  if (n >= keys.length) return [...keys];
  const pts = keys.map(P);
  let centers = spreadNodes(keys, P, n).map((k) => ({ ...P(k) })); // FPS seeds
  const assign = new Array(keys.length).fill(0);
  for (let it = 0; it < 10; it++) {
    for (let i = 0; i < pts.length; i++) {
      let bi = 0, bd = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const d = (pts[i].x - centers[c].x) ** 2 + (pts[i].y - centers[c].y) ** 2;
        if (d < bd) { bd = d; bi = c; }
      }
      assign[i] = bi;
    }
    const sx = new Array(n).fill(0), sy = new Array(n).fill(0), cnt = new Array(n).fill(0);
    for (let i = 0; i < pts.length; i++) { sx[assign[i]] += pts[i].x; sy[assign[i]] += pts[i].y; cnt[assign[i]]++; }
    centers = centers.map((c, k) => (cnt[k] ? { x: sx[k] / cnt[k], y: sy[k] / cnt[k] } : c));
  }
  const used = new Set<string>();
  const out: string[] = [];
  for (const c of centers) {
    let best: string | null = null, bd = Infinity;
    for (let i = 0; i < keys.length; i++) {
      if (used.has(keys[i])) continue;
      const d = (pts[i].x - c.x) ** 2 + (pts[i].y - c.y) ** 2;
      if (d < bd) { bd = d; best = keys[i]; }
    }
    if (best != null) { used.add(best); out.push(best); }
  }
  return out;
}

// Spread n points across a node set: 1 -> nearest the centroid; else
// farthest-point sampling seeded from the most extreme node.
function spreadNodes(keys: string[], P: (k: string) => Point, n: number): string[] {
  if (n >= keys.length) return [...keys];
  let cx = 0, cy = 0;
  for (const k of keys) { const p = P(k); cx += p.x; cy += p.y; }
  cx /= keys.length; cy /= keys.length;
  const d2 = (a: Point, b: Point) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  if (n === 1) {
    let best = keys[0], bd = Infinity;
    for (const k of keys) { const d = d2(P(k), { x: cx, y: cy }); if (d < bd) { bd = d; best = k; } }
    return [best];
  }
  let seed = keys[0], sd = -1;
  for (const k of keys) { const d = d2(P(k), { x: cx, y: cy }); if (d > sd) { sd = d; seed = k; } }
  const chosen = [seed];
  while (chosen.length < n) {
    let best: string | null = null, bestD = -1;
    for (const k of keys) {
      if (chosen.includes(k)) continue;
      let md = Infinity;
      for (const c of chosen) { const d = d2(P(k), P(c)); if (d < md) md = d; }
      if (md > bestD) { bestD = md; best = k; }
    }
    if (best == null) break;
    chosen.push(best);
  }
  return chosen;
}

export function computeBom(doc: Doc, config: BarConfig = defaultBarConfig(), rgbic = false): Bom {
  const g = buildGraph(doc);

  // bars by length / system
  const groups = new Map<string, SegmentGroup>();
  for (const e of g.edges.values()) {
    if (!e.active) continue;
    const sys = SYSTEM_BY_ID[e.systemId];
    const cur = groups.get(e.systemId) ?? {
      systemId: e.systemId,
      label: sys.label,
      segmentLengthMm: sys.segmentLength,
      count: 0,
    };
    cur.count++;
    groups.set(e.systemId, cur);
  }
  const segmentGroups = [...groups.values()].sort(
    (a, b) => a.segmentLengthMm - b.segmentLengthMm,
  );

  // base connectors
  const infos = nodeInfos(g);
  const counts = new Map<ConnectorType, number>();
  for (const info of infos.values()) {
    if (info.type) counts.set(info.type, (counts.get(info.type) ?? 0) + 1);
  }
  const xy = (k: string): Point => ({ x: infos.get(k)!.x, y: infos.get(k)!.y });
  const marker = (k: string): MarkerPoint => {
    const info = infos.get(k)!;
    const o = openDir(info.dirs);
    return { x: info.x, y: info.y, dx: o.dx, dy: o.dy };
  };

  // power runs + power-cord ports + hangers, per connected run.
  const runs = powerRuns(g, config.wattsPerBar);
  const totalWatts = runs.reduce((a, r) => a + r.watts, 0);
  let powerInputs = 0;
  const powerPoints: MarkerPoint[] = [];
  const hangerPoints: MarkerPoint[] = [];

  for (const run of runs) {
    const deg = (k: string) => infos.get(k)?.dirs.length ?? 0;
    const inputs = Math.max(1, Math.ceil(run.watts / MAX_WATTS_PER_RUN));
    powerInputs += inputs;

    // cord attach points: a cord needs a free port, so only nodes that can host
    // one are candidates — an open bar end (degree 1, already free) or a
    // connector with room to add a port (degree <= 3 -> upgrades to Y/T/X). A
    // saturated X (degree 4) has no free port and is excluded. Prefer the most
    // accessible tier (ends, then 2-way, then 3-way), then spread across the run.
    const ends = run.nodes.filter((k) => deg(k) === 1);
    let pool = ends;
    if (pool.length < inputs) pool = pool.concat(run.nodes.filter((k) => deg(k) === 2));
    if (pool.length < inputs) pool = pool.concat(run.nodes.filter((k) => deg(k) === 3));
    if (pool.length === 0) pool = run.nodes.filter((k) => deg(k) < 4);
    if (pool.length === 0) pool = run.nodes; // pathological: fully saturated run
    const cordNodes = spreadNodes(pool, xy, inputs);
    for (const k of cordNodes) {
      powerPoints.push(marker(k));
      const info = infos.get(k)!;
      if (deg(k) !== 1 && info.type) {
        const to = PORT_UPGRADE[info.type];
        if (to) {
          counts.set(info.type, (counts.get(info.type) ?? 0) - 1);
          counts.set(to, (counts.get(to) ?? 0) + 1);
        }
      }
    }

    // hangers: distributed grid per the suspension protocol — density ~1 cable
    // per 2.5 hexes AND no span > 3 hexes, 20% inset, snapped to real nodes.
    const rs = new Set(run.nodes);
    let pSum = 0, pN = 0;
    for (const e of g.edges.values()) {
      if (!e.active || !rs.has(e.from) || !rs.has(e.to)) continue;
      const a = g.nodes.get(e.from)!, b = g.nodes.get(e.to)!;
      pSum += Math.hypot(a.x - b.x, a.y - b.y); pN++;
    }
    const pitch = pN ? pSum / pN : 1;
    const hexArea = (3 * SQRT3 / 2) * pitch * pitch;
    let mnX = Infinity, mnY = Infinity, mxX = -Infinity, mxY = -Infinity;
    for (const k of run.nodes) { const p = xy(k); mnX = Math.min(mnX, p.x); mnY = Math.min(mnY, p.y); mxX = Math.max(mxX, p.x); mxY = Math.max(mxY, p.y); }
    const approxHexes = ((mxX - mnX) * (mxY - mnY)) / hexArea;
    // ~1 cable per 2.5 hexes (density); always >=2
    const targetN = Math.min(24, Math.max(2, Math.round(approxHexes / 2.5)));
    for (const k of balancedAnchors(run.nodes, xy, targetN)) hangerPoints.push(marker(k));
  }
  const suspensionPoints = hangerPoints.length;

  const connectorCounts = [...counts.entries()]
    .filter(([, c]) => c > 0)
    .map(([type, count]) => ({ type, count, label: type.toUpperCase() }))
    .sort((a, b) => CONNECTOR_ORDER.indexOf(a.type) - CONNECTOR_ORDER.indexOf(b.type));

  // price in IQD — bars by white/RGBIC rate, connectors + power flat
  const totalSegments = segmentGroups.reduce((a, s) => a + s.count, 0);
  const totalConnectors = connectorCounts.reduce((a, c) => a + c.count, 0);
  let estimatedPrice = 0;
  for (const s of segmentGroups) estimatedPrice += s.count * barPrice(s.systemId, rgbic);
  estimatedPrice += totalConnectors * CONNECTOR_PRICE;
  estimatedPrice += powerInputs * POWER_PRICE;

  return {
    segmentGroups,
    connectorCounts,
    power: { runs: runs.length, totalWatts, powerInputs },
    estimatedPrice,
    totalSegments,
    totalConnectors,
    suspensionPoints,
    powerPoints,
    hangerPoints,
  };
}
