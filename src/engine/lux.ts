// Light Check — lumen-method illuminance estimate.
// Ported from the original bundle: lux = totalLumens * CU(RCR) * MF / area.
// RCR = 5 * cavityHeight * (W + L) / area ; cavityHeight = ceiling - drop - workPlane.

import { Doc, buildGraph } from "./geometry";
import {
  BarLength,
  CU_TABLE,
  LUMENS_PER_BAR,
  MAINTENANCE_FACTOR,
  USE_CASE_BY_ID,
} from "./spec";

export type MountingMode = "flush" | "suspended" | "auto";
export type Zone = "under" | "on" | "over";

export interface LuxInput {
  useCaseId: string;
  roomWidthM: number;
  roomHeightM: number; // room depth (floor plan)
  ceilingHeightM: number;
  mountingMode: MountingMode;
  dropM: number; // suspension drop (suspended mode)
  clusterExtentM: number; // largest layout dimension, for auto drop
}

export interface LuxResult {
  targetLux: number;
  useCaseLabel: string;
  luxEstimate: number | null;
  zone: Zone | null;
  autoDrop: number | null;
  errorMessage: string | null;
  rangeLow: number;
  rangeHigh: number;
}

// Coefficient of Utilisation: linear interpolation over CU_TABLE, clamped.
export function coefficientOfUtilisation(rcr: number): number {
  const t = Math.max(CU_TABLE[0][0], Math.min(CU_TABLE[CU_TABLE.length - 1][0], rcr));
  for (let i = 0; i < CU_TABLE.length - 1; i++) {
    const [n, r] = CU_TABLE[i];
    const [i2, a] = CU_TABLE[i + 1];
    if (t <= i2) return r + ((t - n) / (i2 - n)) * (a - r);
  }
  return CU_TABLE[CU_TABLE.length - 1][1];
}

// auto-drop: keep fixture sensibly below ceiling for the cluster size.
export function autoDrop(clusterExtentM: number, ceilingHeightM: number, workPlaneM: number): { drop: number; clamped: boolean } {
  const r = ceilingHeightM - clusterExtentM / 1.5 - workPlaneM;
  if (r <= 0) return { drop: 0, clamped: true };
  const i = ceilingHeightM - workPlaneM - 0.5;
  return { drop: Math.min(r, Math.max(0, i)), clamped: false };
}

// total bar lumens in the doc
export function totalLumens(doc: Doc): number {
  const g = buildGraph(doc);
  let lm = 0;
  for (const e of g.edges.values()) if (e.active) lm += LUMENS_PER_BAR[e.len as BarLength] ?? 0;
  return lm;
}

export function computeLux(doc: Doc, input: LuxInput): LuxResult {
  const uc = USE_CASE_BY_ID[input.useCaseId];
  const base: LuxResult = {
    targetLux: uc.targetLux,
    useCaseLabel: uc.label,
    luxEstimate: null,
    zone: null,
    autoDrop: null,
    errorMessage: null,
    rangeLow: Math.round((uc.targetLux * 0.7) / 10) * 10,
    rangeHigh: Math.round((uc.targetLux * 1.3) / 10) * 10,
  };

  let drop = input.dropM;
  if (input.mountingMode === "auto") {
    const a = autoDrop(input.clusterExtentM, input.ceilingHeightM, uc.workPlaneM);
    drop = a.drop;
    base.autoDrop = a.drop;
  } else if (input.mountingMode === "flush") {
    drop = 0;
  }

  const cavity = input.ceilingHeightM - drop - uc.workPlaneM;
  if (cavity <= 0) {
    return { ...base, errorMessage: "Mounting height conflicts with ceiling." };
  }

  const lm = totalLumens(doc);
  const W = input.roomWidthM;
  const L = input.roomHeightM;
  const area = W * L;
  if (lm <= 0) return base;
  if (area <= 0) return base;

  const rcr = (5 * cavity * (W + L)) / area;
  const cu = coefficientOfUtilisation(rcr);
  const raw = (lm * cu * MAINTENANCE_FACTOR) / area;
  const lux = Math.round(raw / 10) * 10;

  const low = uc.targetLux * 0.7;
  const high = uc.targetLux * 1.3;
  const zone: Zone = lux < low ? "under" : lux <= high ? "on" : "over";

  return { ...base, luxEstimate: lux, zone };
}
