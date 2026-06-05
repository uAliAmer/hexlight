// Encode a full design + settings into a compact URL fragment — no backend.
// v2: indices instead of id strings, flat integer arrays, then lz-string.
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import { Doc, hexId, lineId } from "./geometry";
import { CCT_OPTIONS, SYSTEMS, USE_CASES } from "./spec";
import { MountingMode } from "./lux";

const MOUNTS: MountingMode[] = ["flush", "suspended", "auto"];

export interface ShareInput {
  name: string;
  orient: "pointy" | "flat";
  hex: string;
  line: string;
  cct: string;
  doc: Doc;
  lux: { useCaseId: string; roomWidthM: number; roomHeightM: number; ceilingHeightM: number; mountingMode: MountingMode; dropM: number };
}

export interface ShareOutput {
  name: string;
  orient: "pointy" | "flat";
  hex: string;
  line: string;
  cct: string;
  doc: Doc;
  lux: ShareInput["lux"];
}

const sysIdx = (id: string) => Math.max(0, SYSTEMS.findIndex((s) => s.id === id));
const sysId = (i: number) => (SYSTEMS[i] ?? SYSTEMS[0]).id;

export function encodeDesign(p: ShareInput): string {
  const H: number[] = [];
  for (const h of Object.values(p.doc.hexes)) H.push(sysIdx(h.systemId), h.q, h.r);
  const L: number[] = [];
  for (const l of Object.values(p.doc.lines))
    L.push(sysIdx(l.systemId), Math.round(l.ax), Math.round(l.ay), Math.round(l.bx), Math.round(l.by));

  const payload = {
    v: 2,
    n: p.name,
    o: p.orient === "flat" ? 1 : 0,
    h: sysIdx(p.hex),
    l: sysIdx(p.line),
    c: Math.max(0, CCT_OPTIONS.findIndex((c) => c.id === p.cct)),
    x: [
      Math.max(0, USE_CASES.findIndex((u) => u.id === p.lux.useCaseId)),
      p.lux.roomWidthM, p.lux.roomHeightM, p.lux.ceilingHeightM,
      MOUNTS.indexOf(p.lux.mountingMode), p.lux.dropM,
    ],
    H, L,
  };
  return compressToEncodedURIComponent(JSON.stringify(payload));
}

export function decodeDesign(s: string): ShareOutput | null {
  try {
    const json = decompressFromEncodedURIComponent(s);
    if (!json) return null;
    const p = JSON.parse(json);
    if (!p || p.v !== 2) return null;

    const hexes: Doc["hexes"] = {};
    const H: number[] = p.H ?? [];
    for (let i = 0; i + 2 < H.length; i += 3) {
      const systemId = sysId(H[i]);
      const q = H[i + 1], r = H[i + 2];
      const id = hexId(systemId, q, r);
      hexes[id] = { id, systemId, q, r };
    }
    const lines: Doc["lines"] = {};
    const L: number[] = p.L ?? [];
    for (let i = 0; i + 4 < L.length; i += 5) {
      const systemId = sysId(L[i]);
      const ax = L[i + 1], ay = L[i + 2], bx = L[i + 3], by = L[i + 4];
      const id = lineId(ax, ay, bx, by);
      lines[id] = { id, systemId, ax, ay, bx, by };
    }

    const x = p.x ?? [0, 5, 6, 2.8, 0, 0.3];
    return {
      name: p.n ?? "",
      orient: p.o === 1 ? "flat" : "pointy",
      hex: sysId(p.h ?? 0),
      line: sysId(p.l ?? 0),
      cct: (CCT_OPTIONS[p.c ?? 0] ?? CCT_OPTIONS[0]).id,
      doc: { hexes, lines },
      lux: {
        useCaseId: (USE_CASES[x[0]] ?? USE_CASES[0]).id,
        roomWidthM: x[1], roomHeightM: x[2], ceilingHeightM: x[3],
        mountingMode: MOUNTS[x[4]] ?? "flush", dropM: x[5],
      },
    };
  } catch {
    return null;
  }
}
