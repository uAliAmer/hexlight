// Ready-made layout templates. Honeycombs are built as offset rows (pointy-top
// "odd-r" brick packing) so they form the familiar rectangular honeycomb blocks,
// not spiral blobs.

import { Doc, HexCell, LineSeg, buildGraph, hexId, hexVertices, lineId } from "./geometry";

// rows = width of each successive offset row, top -> bottom.
function honeycombRows(systemId: string, rows: number[], dq = 0, dr = 0): Record<string, HexCell> {
  const cells: [number, number][] = [];
  rows.forEach((w, ri) => {
    const off = (ri - (ri & 1)) / 2; // odd-r offset keeps the block rectangular
    for (let c = 0; c < w; c++) cells.push([c - off, ri]);
  });
  // centre on origin
  let mq = 0, mr = 0;
  for (const [q, r] of cells) { mq += q; mr += r; }
  mq = Math.round(mq / cells.length);
  mr = Math.round(mr / cells.length);
  const hexes: Record<string, HexCell> = {};
  for (const [q0, r0] of cells) {
    const q = q0 - mq + dq, r = r0 - mr + dr;
    const id = hexId(systemId, q, r);
    hexes[id] = { id, systemId, q, r };
  }
  return hexes;
}

// rectangular line frame around a set of hexes, padded outward.
function borderFrame(hexes: Record<string, HexCell>, pad: number, lineSystem: string): Record<string, LineSeg> {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const h of Object.values(hexes)) {
    for (const [x, y] of hexVertices(h.systemId, h.q, h.r)) {
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  minX -= pad; minY -= pad; maxX += pad; maxY += pad;
  const sys = lineSystem;
  const corners: [number, number][] = [
    [minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY],
  ];
  const lines: Record<string, LineSeg> = {};
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = corners[i];
    const [bx, by] = corners[(i + 1) % 4];
    const id = lineId(ax, ay, bx, by);
    lines[id] = { id, systemId: sys, ax, ay, bx, by };
  }
  return lines;
}

export interface TemplateDef {
  id: string;
  name: string;
  hexCount: number;
  featured?: boolean;
  // built with whatever hex/line bar sizes are currently selected
  build: (hex?: string, line?: string) => Doc;
}

export const TEMPLATES: TemplateDef[] = [
  {
    id: "h14",
    name: "14-Grid Honeycomb",
    hexCount: 14,
    featured: true,
    build: (hex = "hex440") => ({ hexes: honeycombRows(hex, [5, 4, 5]), lines: {} }),
  },
  { id: "h8", name: "8-Grid Honeycomb", hexCount: 8, build: (hex = "hex440") => ({ hexes: honeycombRows(hex, [4, 4]), lines: {} }) },
  { id: "h5", name: "5-Grid Honeycomb", hexCount: 5, build: (hex = "hex440") => ({ hexes: honeycombRows(hex, [2, 3]), lines: {} }) },
  {
    id: "dual",
    name: "Dual-Zone",
    hexCount: 5,
    build: (hex = "hex440") => ({
      hexes: { ...honeycombRows(hex, [2], 0, -3), ...honeycombRows(hex, [1, 2], 0, 2) },
      lines: {},
    }),
  },
  {
    id: "h8border",
    name: "8-Grid + Border",
    hexCount: 5,
    build: (hex = "hex440", line = "line1176") => {
      const hexes = honeycombRows(hex, [3, 2]);
      return { hexes, lines: borderFrame(hexes, 220, line) };
    },
  },
  { id: "h23", name: "23-Grid Honeycomb", hexCount: 23, build: (hex = "hex440") => ({ hexes: honeycombRows(hex, [4, 5, 5, 5, 4]), lines: {} }) },
];

export const TEMPLATE_BY_ID = Object.fromEntries(TEMPLATES.map((t) => [t.id, t])) as Record<string, TemplateDef>;

// expose for previews that want hex faces, without re-importing
export { buildGraph };
