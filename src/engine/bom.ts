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
  powerPoints: Point[]; // where each power cord plugs in (world mm)
  hangerPoints: Point[]; // where suspension cables attach (world mm)
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

// n evenly-spaced anchor positions along one axis, inset 20% from the extremes
// (web suspension protocol). One point if the extent is negligible or n<=1.
function linInset(lo: number, hi: number, n: number, hexStep: number): number[] {
  const span = hi - lo;
  if (span < hexStep * 0.5 || n <= 1) return [(lo + hi) / 2];
  const inLo = lo + 0.2 * span, inHi = hi - 0.2 * span;
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(inLo + ((inHi - inLo) * i) / (n - 1));
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

  // power runs + power-cord ports + hangers, per connected run.
  const runs = powerRuns(g, config.wattsPerBar);
  const totalWatts = runs.reduce((a, r) => a + r.watts, 0);
  let powerInputs = 0;
  const powerPoints: Point[] = [];
  const hangerPoints: Point[] = [];

  for (const run of runs) {
    const deg = (k: string) => infos.get(k)?.dirs.length ?? 0;
    const inputs = Math.max(1, Math.ceil(run.watts / MAX_WATTS_PER_RUN));
    powerInputs += inputs;

    // cord attach points: spread across the run so feeds are balanced. A cord on
    // a connector (not an open end) upgrades it by a port.
    const cordNodes = spreadNodes(run.nodes, xy, inputs);
    for (const k of cordNodes) {
      powerPoints.push(xy(k));
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
    const hexStep = SQRT3 * pitch;              // hex centre-to-centre
    const hexArea = (3 * SQRT3 / 2) * pitch * pitch;
    let mnX = Infinity, mnY = Infinity, mxX = -Infinity, mxY = -Infinity;
    for (const k of run.nodes) { const p = xy(k); mnX = Math.min(mnX, p.x); mnY = Math.min(mnY, p.y); mxX = Math.max(mxX, p.x); mxY = Math.max(mxY, p.y); }
    const w = mxX - mnX, h = mxY - mnY;
    const approxHexes = (Math.max(w, hexStep) * Math.max(h, hexStep)) / hexArea;
    const targetN = Math.min(24, Math.max(2, Math.round(approxHexes / 2.5)));
    // grid: density-driven count, raised if any span would exceed 3 hexes
    const minCols = Math.max(1, Math.ceil((0.6 * w) / (3 * hexStep)) + 1);
    const minRows = Math.max(1, Math.ceil((0.6 * h) / (3 * hexStep)) + 1);
    const aspect = Math.max(w, hexStep) / Math.max(h, hexStep);
    let cols = Math.max(minCols, Math.round(Math.sqrt(targetN * aspect)) || 1);
    let rows = Math.max(minRows, Math.ceil(targetN / cols));
    const xs = linInset(mnX, mxX, cols, hexStep), ys = linInset(mnY, mxY, rows, hexStep);
    const used = new Set<string>();
    for (const tx of xs) for (const ty of ys) {
      let best: string | null = null, bd = Infinity;
      for (const k of run.nodes) { const p = xy(k); const d = (p.x - tx) ** 2 + (p.y - ty) ** 2; if (d < bd) { bd = d; best = k; } }
      if (best != null && Math.sqrt(bd) <= hexStep * 1.4 && !used.has(best)) { used.add(best); hangerPoints.push(xy(best)); }
    }
    if (used.size < 2 && run.nodes.length) { // fallback: two extremes
      const ks = [...run.nodes].sort((a, b) => xy(a).x + xy(a).y - (xy(b).x + xy(b).y));
      for (const k of [ks[0], ks[ks.length - 1]]) if (k && !used.has(k)) { used.add(k); hangerPoints.push(xy(k)); }
    }
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
