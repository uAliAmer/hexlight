// Ready-made layout templates. Each template carries its own grid orientation
// and an explicit set of axial cells (as drawn in the editor). Hex/line bar
// sizes follow the user's current selection; borders are regenerated to fit.

import {
  Doc,
  HexCell,
  LineSeg,
  Orientation,
  buildGraph,
  hexId,
  hexVertices,
  lineId,
  setOrientation,
} from "./geometry";

type Cell = [number, number];

function cellsToHexes(systemId: string, cells: Cell[]): Record<string, HexCell> {
  const hexes: Record<string, HexCell> = {};
  for (const [q, r] of cells) {
    const id = hexId(systemId, q, r);
    hexes[id] = { id, systemId, q, r };
  }
  return hexes;
}

// rectangular line frame just outside the hexes (uses current orientation)
function borderFrame(hexes: Record<string, HexCell>, pad: number, lineSystem: string): Record<string, LineSeg> {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const h of Object.values(hexes)) {
    for (const [x, y] of hexVertices(h.systemId, h.q, h.r)) {
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  minX -= pad; minY -= pad; maxX += pad; maxY += pad;
  const corners: Cell[] = [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]];
  const lines: Record<string, LineSeg> = {};
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = corners[i];
    const [bx, by] = corners[(i + 1) % 4];
    const id = lineId(ax, ay, bx, by);
    lines[id] = { id, systemId: lineSystem, ax, ay, bx, by };
  }
  return lines;
}

export interface TemplateDef {
  id: string;
  name: string;
  hexCount: number;
  orientation: Orientation;
  featured?: boolean;
  build: (hex?: string, line?: string) => Doc;
}

function tpl(
  id: string,
  name: string,
  orientation: Orientation,
  cells: Cell[],
  opts?: { featured?: boolean; border?: number },
): TemplateDef {
  return {
    id,
    name,
    orientation,
    hexCount: cells.length,
    featured: opts?.featured,
    build: (hex = "t5_60", line = "t5_120") => {
      setOrientation(orientation); // border + previews need the right geometry
      const hexes = cellsToHexes(hex, cells);
      const lines = opts?.border != null ? borderFrame(hexes, opts.border, line) : {};
      return { hexes, lines };
    },
  };
}

// centred [5,4,5] honeycomb for the featured card (pointy-top odd-r)
const G14: Cell[] = [
  [0, -1], [1, -1], [2, -1], [3, -1], [4, -1],
  [0, 0], [1, 0], [2, 0], [3, 0],
  [-1, 1], [0, 1], [1, 1], [2, 1], [3, 1],
];

export const TEMPLATES: TemplateDef[] = [
  tpl("h14", "خلية 14", "pointy", G14, { featured: true }),
  tpl("h8", "خلية 8", "pointy", [
    [-1, -1], [0, -1], [1, -1], [0, 0], [-1, 0], [-2, 1], [-1, 1], [0, 1],
  ]),
  tpl("h5", "خلية 5", "flat", [
    [-1, 0], [0, 0], [1, -1], [1, 0], [-1, 1],
  ]),
  tpl("dual", "منطقتان", "flat", [
    [1, -3], [-1, -2], [0, -2], [1, -2], [-1, -1], [1, 0], [-1, 1], [0, 1], [1, 1], [-1, 2],
  ]),
  tpl("h13border", "خلية 13 + إطار", "flat", [
    [-2, 1], [-2, 2], [-1, 1], [0, 0], [0, 1], [1, 0], [2, -1], [2, 0], [2, 1], [1, 1], [0, 2], [-1, 2], [-2, 3],
  ], { border: 120 }),
  tpl("h23", "خلية 23", "pointy", [
    [0, -3], [1, -3], [2, -3], [3, -3], [4, -3],
    [3, -2], [2, -2], [1, -2], [0, -2],
    [-1, -1], [0, -1], [1, -1], [2, -1], [3, -1],
    [2, 0], [1, 0], [0, 0], [-1, 0],
    [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1],
  ]),
];

export const TEMPLATE_BY_ID = Object.fromEntries(TEMPLATES.map((t) => [t.id, t])) as Record<string, TemplateDef>;

export { buildGraph };
