// Bill of materials + connector classification + power runs.
// Connector classifier ported from the original bundle's `ue(degree, dirs)`.

import { adjacency, buildGraph, Doc, Graph } from "./geometry";
import {
  BarConfig,
  BarLength,
  ConnectorType,
  CONNECTOR_ORDER,
  defaultBarConfig,
  MAX_WATTS_PER_RUN,
  SYSTEM_BY_ID,
  SYSTEMS,
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
}

// Connected components of active edges -> each is a power run.
function powerRuns(g: Graph, wattsPerBar: Record<BarLength, number>): { watts: number }[] {
  const adj = adjacency(g);
  const seen = new Set<string>();
  const runs: { watts: number }[] = [];
  for (const start of g.nodes.keys()) {
    if (seen.has(start)) continue;
    if (!adj.has(start)) {
      seen.add(start);
      continue;
    }
    // BFS over nodes; sum each edge once
    const stack = [start];
    seen.add(start);
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
          stack.push(nbr);
        }
      }
    }
    if (edgeSeen.size > 0) runs.push({ watts });
  }
  return runs;
}

export function computeBom(doc: Doc, config: BarConfig = defaultBarConfig()): Bom {
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

  // connectors
  const counts = new Map<ConnectorType, number>();
  for (const info of nodeInfos(g).values()) {
    if (!info.type) continue;
    counts.set(info.type, (counts.get(info.type) ?? 0) + 1);
  }
  const connectorCounts = [...counts.entries()]
    .filter(([, c]) => c > 0)
    .map(([type, count]) => ({ type, count, label: type.toUpperCase() }))
    .sort((a, b) => CONNECTOR_ORDER.indexOf(a.type) - CONNECTOR_ORDER.indexOf(b.type));

  // power
  const runs = powerRuns(g, config.wattsPerBar);
  const totalWatts = runs.reduce((a, r) => a + r.watts, 0);
  const powerInputs = runs.reduce((a, r) => a + Math.max(1, Math.ceil(r.watts / MAX_WATTS_PER_RUN)), 0);

  // price (per-system rates, weighted)
  let estimatedPrice = 0;
  const totalSegments = segmentGroups.reduce((a, s) => a + s.count, 0);
  const totalConnectors = connectorCounts.reduce((a, c) => a + c.count, 0);
  for (const s of segmentGroups) estimatedPrice += s.count * SYSTEM_BY_ID[s.systemId].pricePerSegment;
  // connectors/PSU priced at the dominant system's rate
  const domSys = segmentGroups[0] ? SYSTEM_BY_ID[segmentGroups[0].systemId] : SYSTEMS[0];
  estimatedPrice += totalConnectors * domSys.pricePerConnector;
  estimatedPrice += powerInputs * domSys.pricePerPowerSupply;

  return {
    segmentGroups,
    connectorCounts,
    power: { runs: runs.length, totalWatts, powerInputs },
    estimatedPrice,
    totalSegments,
    totalConnectors,
  };
}
