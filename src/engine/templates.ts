// Ready-made layout templates. Honeycomb clusters are generated as a hex spiral
// (rings outward from the centre) and truncated to the requested hex count.

import { Doc, HexCell, hexId } from "./geometry";

function spiral(n: number): [number, number][] {
  const out: [number, number][] = [[0, 0]];
  const dirs: [number, number][] = [
    [1, 0],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [0, -1],
    [1, -1],
  ];
  let radius = 1;
  while (out.length < n) {
    let q = -radius,
      r = radius; // start of ring
    for (let side = 0; side < 6 && out.length < n; side++) {
      for (let step = 0; step < radius && out.length < n; step++) {
        out.push([q, r]);
        q += dirs[side][0];
        r += dirs[side][1];
      }
    }
    radius++;
  }
  return out.slice(0, n);
}

function honeycomb(systemId: string, count: number, dq = 0, dr = 0): Record<string, HexCell> {
  const hexes: Record<string, HexCell> = {};
  for (const [q0, r0] of spiral(count)) {
    const q = q0 + dq,
      r = r0 + dr;
    hexes[hexId(systemId, q, r)] = { id: hexId(systemId, q, r), systemId, q, r };
  }
  return hexes;
}

export interface TemplateDef {
  id: string;
  name: string;
  hexCount: number;
  build: () => Doc;
}

export const TEMPLATES: TemplateDef[] = [
  { id: "h5", name: "5-Grid Honeycomb", hexCount: 5, build: () => ({ hexes: honeycomb("hex440", 5), lines: {} }) },
  { id: "h8", name: "8-Grid Honeycomb", hexCount: 8, build: () => ({ hexes: honeycomb("hex440", 8), lines: {} }) },
  { id: "h14", name: "14-Grid Honeycomb", hexCount: 14, build: () => ({ hexes: honeycomb("hex565", 14), lines: {} }) },
  { id: "h23", name: "23-Grid Honeycomb", hexCount: 23, build: () => ({ hexes: honeycomb("hex565", 23), lines: {} }) },
  {
    id: "dual",
    name: "Dual-Zone",
    hexCount: 14,
    build: () => ({ hexes: { ...honeycomb("hex440", 7, -5, 2), ...honeycomb("hex440", 7, 5, -2) }, lines: {} }),
  },
  {
    id: "h8border",
    name: "8-Grid + Border",
    hexCount: 8,
    build: () => ({ hexes: { ...honeycomb("hex440", 8), ...honeycomb("hex440", 6, 0, 3) }, lines: {} }),
  },
];

export const TEMPLATE_BY_ID = Object.fromEntries(TEMPLATES.map((t) => [t.id, t])) as Record<string, TemplateDef>;
