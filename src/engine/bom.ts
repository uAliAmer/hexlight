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
// used connector is not. So per power input with no open end available, one
// connector in that run gets upgraded by one port (V->Y, I/L->T, Y/T->X).
const PORT_UPGRADE: Partial<Record<ConnectorType, ConnectorType>> = {
  v: "y", l: "t", i: "t", y: "multi", t: "multi",
};
const UPGRADE_PREFERENCE: ConnectorType[] = ["v", "l", "i", "y", "t"]; // 2-way first

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
  // - Each cord needs a free port: an open bar end (degree 1) is free, else
  //   upgrade one connector by a port (V->Y, I/L->T, Y/T->X) at the cord node.
  // - Hangers: every junction (deg>=3) + free end (deg 1); a pure loop with
  //   neither gets two spread-out anchors.
  const runs = powerRuns(g, config.wattsPerBar);
  const totalWatts = runs.reduce((a, r) => a + r.watts, 0);
  let powerInputs = 0;
  const powerPoints: Point[] = [];
  const hangerPoints: Point[] = [];

  for (const run of runs) {
    const deg = (k: string) => infos.get(k)?.dirs.length ?? 0;
    const inputs = Math.max(1, Math.ceil(run.watts / MAX_WATTS_PER_RUN));
    powerInputs += inputs;

    // cord attach points: open ends first, then upgraded connectors
    const ends = run.nodes.filter((k) => deg(k) === 1);
    const cordNodes: string[] = ends.slice(0, inputs);
    let need = inputs - cordNodes.length;
    if (need > 0) {
      const byType = new Map<ConnectorType, string[]>();
      for (const k of run.nodes) {
        const t = infos.get(k)?.type;
        if (t) (byType.get(t) ?? byType.set(t, []).get(t)!).push(k);
      }
      for (const from of UPGRADE_PREFERENCE) {
        const to = PORT_UPGRADE[from];
        const pool = byType.get(from);
        if (!to || !pool) continue;
        while (need > 0 && pool.length > 0) {
          const k = pool.pop()!;
          counts.set(from, (counts.get(from) ?? 0) - 1);
          counts.set(to, (counts.get(to) ?? 0) + 1);
          cordNodes.push(k);
          need--;
        }
        if (need === 0) break;
      }
    }
    for (const k of cordNodes) powerPoints.push(xy(k));

    // hangers
    const anchors = run.nodes.filter((k) => deg(k) === 1 || deg(k) >= 3);
    if (anchors.length === 0) {
      // pure loop: two most-separated nodes
      const sorted = [...run.nodes].sort(
        (a, b) => infos.get(a)!.x + infos.get(a)!.y - (infos.get(b)!.x + infos.get(b)!.y),
      );
      if (sorted.length) { hangerPoints.push(xy(sorted[0])); if (sorted.length > 1) hangerPoints.push(xy(sorted[sorted.length - 1])); }
    } else {
      for (const k of anchors) hangerPoints.push(xy(k));
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
