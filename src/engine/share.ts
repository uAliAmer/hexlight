// Encode a full design + settings into a compact URL fragment — no backend.
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import { Doc, hexId, lineId } from "./geometry";
import { MountingMode } from "./lux";

export interface SharePayload {
  v: 1;
  name: string;
  orient: "pointy" | "flat";
  hex: string;
  line: string;
  cct: string;
  // compact doc
  h: [string, number, number][]; // [systemId, q, r]
  l: [string, number, number, number, number][]; // [systemId, ax, ay, bx, by]
  lux: {
    u: string; w: number; d: number; c: number; m: MountingMode; dr: number;
  };
}

export function encodeDesign(p: SharePayload): string {
  return compressToEncodedURIComponent(JSON.stringify(p));
}

export function decodeDesign(s: string): SharePayload | null {
  try {
    const json = decompressFromEncodedURIComponent(s);
    if (!json) return null;
    const p = JSON.parse(json);
    if (p && p.v === 1) return p as SharePayload;
    return null;
  } catch {
    return null;
  }
}

export function docToCompact(doc: Doc): { h: SharePayload["h"]; l: SharePayload["l"] } {
  const h: SharePayload["h"] = Object.values(doc.hexes).map((x) => [x.systemId, x.q, x.r]);
  const l: SharePayload["l"] = Object.values(doc.lines).map((x) => [x.systemId, x.ax, x.ay, x.bx, x.by]);
  return { h, l };
}

export function compactToDoc(h: SharePayload["h"], l: SharePayload["l"]): Doc {
  const hexes: Doc["hexes"] = {};
  for (const [systemId, q, r] of h ?? []) {
    const id = hexId(systemId, q, r);
    hexes[id] = { id, systemId, q, r };
  }
  const lines: Doc["lines"] = {};
  for (const [systemId, ax, ay, bx, by] of l ?? []) {
    const id = lineId(ax, ay, bx, by);
    lines[id] = { id, systemId, ax, ay, bx, by };
  }
  return { hexes, lines };
}
