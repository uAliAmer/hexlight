// Flat-top hexagon honeycomb geometry + a derived node/edge graph.
// World units are millimetres. Vertices are deduplicated by quantized position
// so adjacent hexes share nodes and edges automatically.

import { SYSTEM_BY_ID } from "./spec";

// Node-to-node pitch = bar tube length + a connector arm at each end.
// The connector is the SAME radial size (arm) for every type (I/L/V/Y/T/X), so
// the pitch only depends on the bar size, not the junction angle. Each bar end
// backs off `arm` from the shared node along its own direction (see `shorten`
// in the renderers), which carves the connector gap correctly at any angle.
export const pitchMm = (systemId: string): number => {
  const s = SYSTEM_BY_ID[systemId];
  return s.segmentLength + 2 * s.barEndToConnectorCenterMm;
};

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

// --- hex layout (orientation switchable) ---
// circumradius R == edge length L for a regular hexagon.
const SQRT3 = Math.sqrt(3);

export type Orientation = "pointy" | "flat";
let ORIENT: Orientation = "pointy";
export const setOrientation = (o: Orientation) => { ORIENT = o; };
export const getOrientation = (): Orientation => ORIENT;

export function hexCenter(systemId: string, q: number, r: number): [number, number] {
  const R = pitchMm(systemId);
  if (ORIENT === "pointy") {
    return [R * SQRT3 * (q + r / 2), R * 1.5 * r];
  }
  return [R * 1.5 * q, R * SQRT3 * (r + q / 2)];
}

export function hexVertices(systemId: string, q: number, r: number): [number, number][] {
  const R = pitchMm(systemId);
  const [cx, cy] = hexCenter(systemId, q, r);
  // pointy-top: corner straight up (-90 + 60k). flat-top: corner at 0 + 60k.
  const off = ORIENT === "pointy" ? -90 : 0;
  const out: [number, number][] = [];
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 180) * (60 * k + off);
    out.push([snap(cx + R * Math.cos(a)), snap(cy + R * Math.sin(a))]);
  }
  return out;
}

// Pixel -> nearest hex cell (axial) for a given system, using cube rounding.
export function pixelToHex(systemId: string, x: number, y: number): [number, number] {
  const R = pitchMm(systemId);
  let q: number, r: number;
  if (ORIENT === "pointy") {
    q = ((SQRT3 / 3) * x - (1 / 3) * y) / R;
    r = ((2 / 3) * y) / R;
  } else {
    q = ((2 / 3) * x) / R;
    r = ((-1 / 3) * x + (SQRT3 / 3) * y) / R;
  }
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
  const L = pitchMm(systemId);
  return [Math.round(x / L) * L, Math.round(y / L) * L];
}

// 8-direction line: anchor at the nearest lattice node, draw one bar in the
// nearest 45° direction toward the cursor. Axis dirs stay on the square grid;
// diagonals are unit-length (off-grid) so the bar is always exactly one length.
export function nearestLineEdge(systemId: string, x: number, y: number): LineSeg {
  const L = pitchMm(systemId);
  const ax = Math.round(x / L) * L; // anchor node
  const ay = Math.round(y / L) * L;
  let dx = x - ax,
    dy = y - ay;
  if (Math.hypot(dx, dy) < 1e-6) { dx = 1; dy = 0; }
  const step = Math.PI / 4;
  const ang = Math.round(Math.atan2(dy, dx) / step) * step;
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const bx = r1(ax + Math.cos(ang) * L);
  const by = r1(ay + Math.sin(ang) * L);
  return { id: lineId(ax, ay, bx, by), systemId, ax, ay, bx, by };
}

export const lineId = (ax: number, ay: number, bx: number, by: number) => {
  const [a, b] = [`${ax},${ay}`, `${bx},${by}`].sort();
  return `line:${a}:${b}`;
};

// --- 8-direction line placement with legality validation ---
type Pt = [number, number];
const NK = 2;
const nk = (x: number, y: number) => `${Math.round(x * NK)}|${Math.round(y * NK)}`;

function unitDirsAt(g: Graph, px: number, py: number): Pt[] {
  const key = nk(px, py);
  const out: Pt[] = [];
  for (const e of g.edges.values()) {
    if (!e.active) continue;
    const a = g.nodes.get(e.from)!, b = g.nodes.get(e.to)!;
    let ox: number, oy: number;
    if (nk(a.x, a.y) === key) { ox = b.x - px; oy = b.y - py; }
    else if (nk(b.x, b.y) === key) { ox = a.x - px; oy = a.y - py; }
    else continue;
    const m = Math.hypot(ox, oy) || 1;
    out.push([ox / m, oy / m]);
  }
  return out;
}

const angBetween = (u: Pt, v: Pt) => {
  const d = Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1]));
  return (Math.acos(d) * 180) / Math.PI;
};
// valid junction angles: L=90, V/Y=120, I/T straight=180
const angleOk = (a: number) => [90, 120, 180].some((s) => Math.abs(a - s) < 6);

function properCross(p1: Pt, p2: Pt, p3: Pt, p4: Pt): boolean {
  const o = (a: Pt, b: Pt, c: Pt) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  const o1 = o(p1, p2, p3), o2 = o(p1, p2, p4), o3 = o(p3, p4, p1), o4 = o(p3, p4, p2);
  return o1 !== o2 && o3 !== o4 && o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0;
}
function collinearOverlap(p1: Pt, p2: Pt, p3: Pt, p4: Pt): boolean {
  const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
  const len = Math.hypot(dx, dy) || 1;
  const distTo = (p: Pt) => Math.abs((dx) * (p[1] - p1[1]) - (dy) * (p[0] - p1[0])) / len;
  if (distTo(p3) > 1 || distTo(p4) > 1) return false; // not collinear
  const t = (p: Pt) => ((p[0] - p1[0]) * dx + (p[1] - p1[1]) * dy) / (len * len);
  const lo = Math.max(0, Math.min(t(p3), t(p4)));
  const hi = Math.min(1, Math.max(t(p3), t(p4)));
  return hi - lo > 0.05; // shared length, not just a touch
}

export interface LineProposal {
  seg: LineSeg;
  legal: boolean;
  exists: boolean;
}

// Anchor at the nearest lattice node OR an existing graph node; draw one bar in
// the nearest 45° direction; snap the far end onto a nearby existing node so
// diagonals chain. Returns whether the placement is legal.
export function proposeLine(doc: Doc, systemId: string, x: number, y: number): LineProposal {
  const L = pitchMm(systemId);
  const g = buildGraph(doc);

  // anchor: prefer a real node near the cursor so bars connect to the structure;
  // otherwise fall back to the square lattice for fresh placements.
  let ax = Math.round(x / L) * L, ay = Math.round(y / L) * L;
  let nbd = Infinity, nbx = 0, nby = 0;
  for (const n of g.nodes.values()) {
    const d = Math.hypot(x - n.x, y - n.y);
    if (d < nbd) { nbd = d; nbx = n.x; nby = n.y; }
  }
  if (nbd < L * 0.55) { ax = nbx; ay = nby; }
  let dx = x - ax, dy = y - ay;
  if (Math.hypot(dx, dy) < 1e-6) { dx = 1; dy = 0; }
  const step = Math.PI / 4;
  const ang = Math.round(Math.atan2(dy, dx) / step) * step;
  let bx = Math.round((ax + Math.cos(ang) * L) * 10) / 10;
  let by = Math.round((ay + Math.sin(ang) * L) * 10) / 10;
  for (const n of g.nodes.values()) {
    if (nk(n.x, n.y) === nk(ax, ay)) continue;
    if (Math.hypot(bx - n.x, by - n.y) < L * 0.42) { bx = n.x; by = n.y; break; }
  }

  const seg: LineSeg = { id: lineId(ax, ay, bx, by), systemId, ax, ay, bx, by };
  const exists = !!doc.lines[seg.id];
  if (exists) return { seg, legal: true, exists };
  if (nk(ax, ay) === nk(bx, by)) return { seg, legal: false, exists };

  const legal = validateLine(g, seg);
  return { seg, legal, exists };
}

function pointSegDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// id of the existing line nearest the point (within a per-bar tolerance), or null
export function nearestLineHit(doc: Doc, x: number, y: number): string | null {
  let best: string | null = null, bd = Infinity;
  for (const l of Object.values(doc.lines)) {
    const d = pointSegDist(x, y, l.ax, l.ay, l.bx, l.by);
    const tol = pitchMm(l.systemId) * 0.22;
    if (d < tol && d < bd) { bd = d; best = l.id; }
  }
  return best;
}

export type LineAction =
  | { kind: "remove"; seg: LineSeg }
  | { kind: "add"; seg: LineSeg }
  | { kind: "blocked"; seg: LineSeg };

// What a click/hover does in lines mode: remove the line under the cursor, else
// add a legal new bar, else blocked.
export function lineActionAt(doc: Doc, systemId: string, x: number, y: number): LineAction {
  const hit = nearestLineHit(doc, x, y);
  if (hit) return { kind: "remove", seg: doc.lines[hit] };
  const p = proposeLine(doc, systemId, x, y);
  if (p.exists) return { kind: "remove", seg: p.seg };
  return { kind: p.legal ? "add" : "blocked", seg: p.seg };
}

function validateLine(g: Graph, seg: LineSeg): boolean {
  const p1: Pt = [seg.ax, seg.ay], p2: Pt = [seg.bx, seg.by];
  for (const e of g.edges.values()) {
    if (!e.active) continue;
    const a = g.nodes.get(e.from)!, b = g.nodes.get(e.to)!;
    const q1: Pt = [a.x, a.y], q2: Pt = [b.x, b.y];
    if (properCross(p1, p2, q1, q2)) return false;
    if (collinearOverlap(p1, p2, q1, q2)) return false;
  }
  for (const [P, other] of [[p1, p2], [p2, p1]] as [Pt, Pt][]) {
    const dirs = unitDirsAt(g, P[0], P[1]);
    const nd: Pt = [other[0] - P[0], other[1] - P[1]];
    const m = Math.hypot(nd[0], nd[1]) || 1;
    const all: Pt[] = [...dirs, [nd[0] / m, nd[1] / m]];
    if (all.length > 4) return false; // X (4-way) is the largest connector
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++)
        if (!angleOk(angBetween(all[i], all[j]))) return false;
  }
  return true;
}

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
