// Flat-top hexagon honeycomb geometry + a derived node/edge graph.
// World units are millimetres. Vertices are deduplicated by quantized position
// so adjacent hexes share nodes and edges automatically.

import { SYSTEM_BY_ID } from "./spec";

export interface HexCell {
  id: string; // `${systemId}:${q}:${r}`
  systemId: string;
  q: number;
  r: number;
}

export interface LineSeg {
  id: string; // `line:${ax}:${ay}:${bx}:${by}` (snapped)
  systemId: string; // always a line system (1176)
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

export interface Doc {
  hexes: Record<string, HexCell>;
  lines: Record<string, LineSeg>;
}

export interface GNode {
  key: string;
  x: number;
  y: number;
}
export interface GEdge {
  key: string;
  from: string;
  to: string;
  len: number; // mm
  systemId: string;
  active: boolean;
}
export interface Graph {
  nodes: Map<string, GNode>;
  edges: Map<string, GEdge>;
}

export const emptyDoc = (): Doc => ({ hexes: {}, lines: {} });

// --- quantization ---
const Q = 2; // 0.5mm resolution
const qkey = (x: number, y: number) => `${Math.round(x * Q)}|${Math.round(y * Q)}`;
const snap = (v: number) => Math.round(v * Q) / Q;

// --- pointy-top hex layout ---
// circumradius R == edge length L for a regular hexagon. Top vertex points up.
const SQRT3 = Math.sqrt(3);

export function hexCenter(systemId: string, q: number, r: number): [number, number] {
  const R = SYSTEM_BY_ID[systemId].segmentLength;
  const x = R * SQRT3 * (q + r / 2);
  const y = R * 1.5 * r;
  return [x, y];
}

export function hexVertices(systemId: string, q: number, r: number): [number, number][] {
  const R = SYSTEM_BY_ID[systemId].segmentLength;
  const [cx, cy] = hexCenter(systemId, q, r);
  const out: [number, number][] = [];
  for (let k = 0; k < 6; k++) {
    // pointy-top: corners at -90,-30,30,90,150,210 deg -> top corner straight up
    const a = (Math.PI / 180) * (60 * k - 90);
    out.push([snap(cx + R * Math.cos(a)), snap(cy + R * Math.sin(a))]);
  }
  return out;
}

// Pixel -> nearest hex cell (axial) for a given system, using cube rounding.
export function pixelToHex(systemId: string, x: number, y: number): [number, number] {
  const R = SYSTEM_BY_ID[systemId].segmentLength;
  const q = ((SQRT3 / 3) * x - (1 / 3) * y) / R;
  const r = ((2 / 3) * y) / R;
  return axialRound(q, r);
}

function axialRound(q: number, r: number): [number, number] {
  let x = q,
    z = r,
    y = -x - z;
  let rx = Math.round(x),
    ry = Math.round(y),
    rz = Math.round(z);
  const dx = Math.abs(rx - x),
    dy = Math.abs(ry - y),
    dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return [rx, rz];
}

export const hexId = (systemId: string, q: number, r: number) => `${systemId}:${q}:${r}`;

// --- line grid (square lattice, spacing = bar length) ---
export function snapLinePoint(systemId: string, x: number, y: number): [number, number] {
  const L = SYSTEM_BY_ID[systemId].segmentLength;
  return [Math.round(x / L) * L, Math.round(y / L) * L];
}

// Nearest axis-aligned unit edge of the line lattice to a point.
export function nearestLineEdge(systemId: string, x: number, y: number): LineSeg {
  const L = SYSTEM_BY_ID[systemId].segmentLength;
  const gx = x / L,
    gy = y / L;
  const cx = Math.round(gx),
    cy = Math.round(gy);
  // distance to horizontal edge (toward nearest .5 in x) vs vertical edge
  const fx = gx - Math.floor(gx);
  const fy = gy - Math.floor(gy);
  // candidate horizontal edge on the row nearest to y
  const horiz = Math.abs(fy - Math.round(fy)) < Math.abs(fx - Math.round(fx));
  let ax: number, ay: number, bx: number, by: number;
  if (horiz) {
    const row = Math.round(gy);
    const col = Math.floor(gx);
    ax = col * L;
    bx = (col + 1) * L;
    ay = by = row * L;
  } else {
    const col = Math.round(gx);
    const row = Math.floor(gy);
    ay = row * L;
    by = (row + 1) * L;
    ax = bx = col * L;
  }
  void cx;
  void cy;
  return { id: lineId(ax, ay, bx, by), systemId, ax, ay, bx, by };
}

export const lineId = (ax: number, ay: number, bx: number, by: number) => {
  const [a, b] = [`${ax},${ay}`, `${bx},${by}`].sort();
  return `line:${a}:${b}`;
};

// --- build graph from doc ---
export function buildGraph(doc: Doc): Graph {
  const nodes = new Map<string, GNode>();
  const edges = new Map<string, GEdge>();

  const node = (x: number, y: number): string => {
    const k = qkey(x, y);
    if (!nodes.has(k)) nodes.set(k, { key: k, x: snap(x), y: snap(y) });
    return k;
  };
  const edge = (x1: number, y1: number, x2: number, y2: number, systemId: string) => {
    const a = node(x1, y1);
    const b = node(x2, y2);
    if (a === b) return;
    const k = [a, b].sort().join("~");
    if (edges.has(k)) return;
    const len = SYSTEM_BY_ID[systemId].segmentLength;
    edges.set(k, { key: k, from: a < b ? a : b, to: a < b ? b : a, len, systemId, active: true });
  };

  for (const h of Object.values(doc.hexes)) {
    const v = hexVertices(h.systemId, h.q, h.r);
    for (let k = 0; k < 6; k++) {
      const [x1, y1] = v[k];
      const [x2, y2] = v[(k + 1) % 6];
      edge(x1, y1, x2, y2, h.systemId);
    }
  }
  for (const l of Object.values(doc.lines)) {
    edge(l.ax, l.ay, l.bx, l.by, l.systemId);
  }
  return { nodes, edges };
}

// neighbours of a node: list of [neighbourKey, edge]
export function adjacency(g: Graph): Map<string, { nbr: string; edge: GEdge }[]> {
  const adj = new Map<string, { nbr: string; edge: GEdge }[]>();
  for (const e of g.edges.values()) {
    if (!e.active) continue;
    (adj.get(e.from) ?? adj.set(e.from, []).get(e.from)!).push({ nbr: e.to, edge: e });
    (adj.get(e.to) ?? adj.set(e.to, []).get(e.to)!).push({ nbr: e.from, edge: e });
  }
  return adj;
}
