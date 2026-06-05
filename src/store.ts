import { useCallback, useMemo, useReducer, useState } from "react";
import {
  Doc,
  HexCell,
  LineSeg,
  Orientation,
  emptyDoc,
  hexCenter,
  hexId,
  lineActionAt,
  lineId,
  pixelToHex,
  setOrientation,
} from "./engine/geometry";
import { BarConfig, CCT_BY_ID, defaultBarConfig, SYSTEM_BY_ID } from "./engine/spec";
import { computeBom } from "./engine/bom";
import { computeLux, LuxInput, MountingMode } from "./engine/lux";
import { TEMPLATE_BY_ID } from "./engine/templates";

export type Mode = "hex" | "lines" | "move";

interface DocState {
  past: Doc[];
  present: Doc;
  future: Doc[];
}

type Action =
  | { t: "set"; doc: Doc }
  | { t: "toggleHex"; systemId: string; q: number; r: number }
  | { t: "toggleLine"; seg: LineSeg }
  | { t: "translate"; dx: number; dy: number }
  | { t: "clear" }
  | { t: "undo" }
  | { t: "redo" };

function commit(s: DocState, next: Doc): DocState {
  return { past: [...s.past, s.present].slice(-50), present: next, future: [] };
}

function reducer(s: DocState, a: Action): DocState {
  switch (a.t) {
    case "set":
      return commit(s, a.doc);
    case "clear":
      return commit(s, emptyDoc());
    case "toggleHex": {
      const id = hexId(a.systemId, a.q, a.r);
      const hexes = { ...s.present.hexes };
      if (hexes[id]) delete hexes[id];
      else hexes[id] = { id, systemId: a.systemId, q: a.q, r: a.r } as HexCell;
      return commit(s, { ...s.present, hexes });
    }
    case "toggleLine": {
      const lines = { ...s.present.lines };
      if (lines[a.seg.id]) delete lines[a.seg.id];
      else lines[a.seg.id] = a.seg;
      return commit(s, { ...s.present, lines });
    }
    case "translate": {
      const next = translateDoc(s.present, a.dx, a.dy);
      if (!next) return s; // sub-cell move, no change
      return commit(s, next);
    }
    case "undo": {
      if (!s.past.length) return s;
      const prev = s.past[s.past.length - 1];
      return { past: s.past.slice(0, -1), present: prev, future: [s.present, ...s.future] };
    }
    case "redo": {
      if (!s.future.length) return s;
      const next = s.future[0];
      return { past: [...s.past, s.present], present: next, future: s.future.slice(1) };
    }
  }
}

export interface View {
  scale: number; // px per mm
  tx: number;
  ty: number;
}

const defaultLux = (): LuxInput => ({
  useCaseId: "garage",
  roomWidthM: 5,
  roomHeightM: 6,
  ceilingHeightM: 2.8,
  mountingMode: "flush",
  dropM: 0.3,
  clusterExtentM: 1,
});

export function useEditor() {
  const [docState, dispatch] = useReducer(reducer, {
    past: [],
    present: emptyDoc(),
    future: [],
  });
  const doc = docState.present;

  const [mode, setMode] = useState<Mode>("hex");
  const [hexSystem, setHexSystem] = useState<string>("hex440");
  const [lineSystem, setLineSystem] = useState<string>("line1176");
  const [orientation, setOrient] = useState<Orientation>("pointy");
  const [units, setUnits] = useState<"m" | "cm">("m");
  const [cctId, setCctId] = useState<string>("6500");
  const [layoutName, setLayoutName] = useState<string>("Untitled layout");
  const [barConfig, setBarConfig] = useState<BarConfig>(defaultBarConfig());
  const [view, setView] = useState<View>({ scale: 0.18, tx: 0, ty: 0 });
  const [lux, setLux] = useState<LuxInput>(defaultLux());

  const activeSystem = mode === "lines" ? lineSystem : hexSystem;

  // keep module-level geometry orientation in sync before memos compute
  // (landing previews mutate it as a side effect)
  setOrientation(orientation);

  const toggleOrientation = useCallback(() => {
    setOrient((o) => {
      const next = o === "pointy" ? "flat" : "pointy";
      setOrientation(next); // update module-level geometry before re-render
      return next;
    });
  }, []);

  const bom = useMemo(() => computeBom(doc, barConfig), [doc, orientation, barConfig]);

  // cluster extent (m) for auto-drop, from bom-less quick bounds
  const clusterExtentM = useMemo(() => extentM(doc), [doc, orientation]);
  const lumenScale = CCT_BY_ID[cctId].lumenScale;
  const luxResult = useMemo(
    () => computeLux(doc, { ...lux, clusterExtentM, lumenScale }, barConfig),
    [doc, lux, clusterExtentM, orientation, barConfig, lumenScale],
  );

  const placeAt = useCallback(
    (worldX: number, worldY: number) => {
      if (mode === "move") return;
      if (mode === "hex") {
        const [q, r] = pixelToHex(hexSystem, worldX, worldY);
        dispatch({ t: "toggleHex", systemId: hexSystem, q, r });
      } else {
        const a = lineActionAt(doc, lineSystem, worldX, worldY);
        if (a.kind !== "blocked") dispatch({ t: "toggleLine", seg: a.seg });
      }
    },
    [mode, hexSystem, lineSystem, doc],
  );

  // Move the whole layout by a world-space delta (mm). Hex shifts snap to axial
  // cells, line shifts snap to the bar lattice, so the design stays rigid.
  const translateDoc = useCallback((dx: number, dy: number) => {
    dispatch({ t: "translate", dx, dy });
  }, []);

  const loadTemplate = useCallback((id: string) => {
    const t = TEMPLATE_BY_ID[id];
    if (!t) return;
    setOrientation(t.orientation); // template defines its own grid orientation
    setOrient(t.orientation);
    dispatch({ t: "set", doc: t.build(hexSystem, lineSystem) });
  }, [hexSystem, lineSystem]);

  return {
    doc,
    mode,
    setMode,
    hexSystem,
    setHexSystem,
    lineSystem,
    setLineSystem,
    activeSystem,
    orientation,
    toggleOrientation,
    units,
    setUnits,
    cctId,
    setCctId,
    layoutName,
    setLayoutName,
    barConfig,
    setBarConfig,
    view,
    setView,
    lux,
    setLux,
    luxResult,
    bom,
    placeAt,
    translateDoc,
    loadTemplate,
    clear: () => dispatch({ t: "clear" }),
    undo: () => dispatch({ t: "undo" }),
    redo: () => dispatch({ t: "redo" }),
    canUndo: docState.past.length > 0,
    canRedo: docState.future.length > 0,
    setDoc: (d: Doc) => dispatch({ t: "set", doc: d }),
  };
}

export type Editor = ReturnType<typeof useEditor>;

// Rigidly translate the whole doc by a world delta (mm), snapping to the grid.
// Returns null when the move rounds to no change. Orientation-aware via geometry.
function translateDoc(doc: Doc, dx: number, dy: number): Doc | null {
  const firstHex = Object.values(doc.hexes)[0];
  if (firstHex) {
    const [dq, dr] = pixelToHex(firstHex.systemId, dx, dy); // rounded axial delta
    if (dq === 0 && dr === 0) return null;
    const [wdx, wdy] = hexCenter(firstHex.systemId, dq, dr); // world delta (linear)
    const hexes: Record<string, HexCell> = {};
    for (const h of Object.values(doc.hexes)) {
      const q = h.q + dq, r = h.r + dr;
      const id = hexId(h.systemId, q, r);
      hexes[id] = { id, systemId: h.systemId, q, r };
    }
    const lines: Record<string, LineSeg> = {};
    for (const l of Object.values(doc.lines)) {
      const seg = shiftLine(l, wdx, wdy);
      lines[seg.id] = seg;
    }
    return { hexes, lines };
  }
  // lines-only: snap to bar lattice
  const lineVals = Object.values(doc.lines);
  if (!lineVals.length) return null;
  const L = SYSTEM_BY_ID[lineVals[0].systemId].segmentLength;
  const sdx = Math.round(dx / L) * L, sdy = Math.round(dy / L) * L;
  if (sdx === 0 && sdy === 0) return null;
  const lines: Record<string, LineSeg> = {};
  for (const l of lineVals) {
    const seg = shiftLine(l, sdx, sdy);
    lines[seg.id] = seg;
  }
  return { hexes: {}, lines };
}

function shiftLine(l: LineSeg, dx: number, dy: number): LineSeg {
  const ax = l.ax + dx, ay = l.ay + dy, bx = l.bx + dx, by = l.by + dy;
  return { id: lineId(ax, ay, bx, by), systemId: l.systemId, ax, ay, bx, by };
}

// rough world extent in metres (mm -> m)
function extentM(doc: Doc): number {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity,
    any = false;
  const pt = (x: number, y: number) => {
    any = true;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const l of Object.values(doc.lines)) {
    pt(l.ax, l.ay);
    pt(l.bx, l.by);
  }
  // approximate hex centres via vertices is overkill here; use line + hex bounds lazily
  for (const h of Object.values(doc.hexes)) {
    const R = SYSTEM_BY_ID[h.systemId].segmentLength;
    const [cx, cy] = hexCenter(h.systemId, h.q, h.r);
    pt(cx - R, cy - R);
    pt(cx + R, cy + R);
  }
  if (!any) return 1;
  return Math.max(maxX - minX, maxY - minY) / 1000 || 1;
}

export type { LuxInput, MountingMode };
