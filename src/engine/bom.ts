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

  // connectors + suspension points (anchor at every junction ≥3 and free end =1)
  const infos = nodeInfos(g);
  const counts = new Map<ConnectorType, number>();
  let suspensionPoints = 0;
  for (const info of infos.values()) {
    const deg = info.dirs.length;
    if (deg === 1 || deg >= 3) suspensionPoints++;
    if (!info.type) continue;
    counts.set(info.type, (counts.get(info.type) ?? 0) + 1);
  }
  if (suspensionPoints < 2 && g.edges.size > 0) suspensionPoints = 2; // a bar needs both ends held

  // power runs + power-cord ports: each cord needs one free port. Open bar ends
  // (degree 1) are free; otherwise upgrade one connector in that run by a port.
  const runs = powerRuns(g, config.wattsPerBar);
  const totalWatts = runs.reduce((a, r) => a + r.watts, 0);
  let powerInputs = 0;
  for (const run of runs) {
    const inputs = Math.max(1, Math.ceil(run.watts / MAX_WATTS_PER_RUN));
    powerInputs += inputs;
    const openEnds = run.nodes.filter((k) => (infos.get(k)?.dirs.length ?? 0) === 1).length;
    let deficit = Math.max(0, inputs - openEnds);
    if (deficit === 0) continue;
    // connector types available to upgrade within this run
    const local = new Map<ConnectorType, number>();
    for (const k of run.nodes) {
      const t = infos.get(k)?.type;
      if (t) local.set(t, (local.get(t) ?? 0) + 1);
    }
    for (const from of UPGRADE_PREFERENCE) {
      const to = PORT_UPGRADE[from];
      if (!to) continue;
      while (deficit > 0 && (local.get(from) ?? 0) > 0) {
        local.set(from, local.get(from)! - 1);
        counts.set(from, (counts.get(from) ?? 0) - 1);
        counts.set(to, (counts.get(to) ?? 0) + 1);
        deficit--;
      }
      if (deficit === 0) break;
    }
  }

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
  };
}
