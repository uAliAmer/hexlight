// Spec constants reverse-engineered from app.hex-planner.com bundle.
// These are the source-of-truth numbers the original planner uses.

export type BarLength = 440 | 565 | 1176;

export interface SystemSpec {
  id: string;
  label: string;
  segmentLength: BarLength; // node-to-node distance, mm
  barEndToConnectorCenterMm: number; // bar is shortened by this at each end; connector occupies center
  pricePerSegment: number;
  pricePerConnector: number;
  pricePerPowerSupply: number;
}

// Order matters: hex systems first, line system last.
export const SYSTEMS: SystemSpec[] = [
  { id: "hex440", label: "440mm", segmentLength: 440, barEndToConnectorCenterMm: 8.9, pricePerSegment: 29, pricePerConnector: 5, pricePerPowerSupply: 49 },
  { id: "hex565", label: "565mm", segmentLength: 565, barEndToConnectorCenterMm: 8.9, pricePerSegment: 35, pricePerConnector: 6, pricePerPowerSupply: 59 },
  { id: "line1176", label: "1176mm", segmentLength: 1176, barEndToConnectorCenterMm: 8.9, pricePerSegment: 59, pricePerConnector: 8, pricePerPowerSupply: 79 },
];

export const SYSTEM_BY_ID = Object.fromEntries(SYSTEMS.map((s) => [s.id, s])) as Record<string, SystemSpec>;

// Electrical
export const WATTS_PER_BAR: Record<BarLength, number> = { 440: 6, 565: 8, 1176: 16 };
export const LM_PER_W = 110; // luminous efficacy
export const DRIVER_EFFICIENCY = 0.86;
export const MAX_WATTS_PER_RUN = 420; // one power input supplies up to this

export const LUMENS_PER_BAR: Record<BarLength, number> = {
  440: WATTS_PER_BAR[440] * LM_PER_W,
  565: WATTS_PER_BAR[565] * LM_PER_W,
  1176: WATTS_PER_BAR[1176] * LM_PER_W,
};

// User-editable bar configuration (Bar configuration popover).
export interface BarConfig {
  lmPerW: number; // luminous efficacy
  driverEff: number; // driver efficiency 0..1
  wattsPerBar: Record<BarLength, number>;
}
export const defaultBarConfig = (): BarConfig => ({
  lmPerW: LM_PER_W,
  driverEff: DRIVER_EFFICIENCY,
  wattsPerBar: { ...WATTS_PER_BAR },
});
export const lumensForBar = (c: BarConfig, len: BarLength): number =>
  (c.wattsPerBar[len] ?? 0) * c.lmPerW;
export const BAR_LENGTHS: BarLength[] = [440, 565, 1176];

// Light Check
export const MAINTENANCE_FACTOR = 0.8; // MF
// Coefficient of Utilisation vs Room Cavity Ratio (RCR): [RCR, CU] pairs, linearly interpolated.
export const CU_TABLE: [number, number][] = [
  [1, 0.65],
  [1.5, 0.58],
  [2, 0.52],
  [3, 0.43],
  [4, 0.36],
  [5, 0.3],
];

export interface UseCase {
  id: string;
  label: string;
  targetLux: number;
  workPlaneM: number; // height of the work plane above floor
}

export const USE_CASES: UseCase[] = [
  { id: "garage", label: "كراج (عام)", targetLux: 300, workPlaneM: 0 },
  { id: "workshop", label: "ورشة", targetLux: 500, workPlaneM: 0.85 },
  { id: "gym", label: "صالة رياضية منزلية", targetLux: 400, workPlaneM: 0 },
  { id: "detailing", label: "تلميع / رشّ", targetLux: 750, workPlaneM: 0 },
  { id: "salon", label: "صالون / حلاقة (لكل كرسي)", targetLux: 500, workPlaneM: 0.85 },
  { id: "living", label: "غرفة معيشة / مطبخ", targetLux: 200, workPlaneM: 0.75 },
];

export const USE_CASE_BY_ID = Object.fromEntries(USE_CASES.map((u) => [u.id, u])) as Record<string, UseCase>;

// LED colour temperature / RGBIC modes. lumenScale reflects the lower white
// output of warmer phosphors and colour (RGBIC) chips.
export interface CctOption {
  id: string;
  label: string;
  color: string; // bar render colour
  lumenScale: number;
  rgbic?: boolean;
}
export const CCT_OPTIONS: CctOption[] = [
  { id: "6500", label: "6500K أبيض", color: "#f1f6ff", lumenScale: 1.0 },
  { id: "4000", label: "4000K أوف وايت", color: "#fff3e2", lumenScale: 0.97 },
  { id: "3000", label: "3000K شمسي", color: "#ffe1b8", lumenScale: 0.9 },
  { id: "rgbic", label: "RGBIC ألوان", color: "#7df0ff", lumenScale: 0.75, rgbic: true },
];
export const CCT_BY_ID = Object.fromEntries(CCT_OPTIONS.map((c) => [c.id, c])) as Record<string, CctOption>;

// Connector types (order = display/sort order). "multi" == X (4-way+).
export type ConnectorType = "i" | "l" | "v" | "y" | "t" | "multi";
export const CONNECTOR_ORDER: ConnectorType[] = ["i", "l", "v", "y", "t", "multi"];
export const CONNECTOR_LABELS: Record<ConnectorType, string> = {
  i: "I — مستقيم",
  l: "L — زاوية قائمة",
  v: "V — اتجاهين بزاوية",
  y: "Y — ثلاثي",
  t: "T — مأخذ طاقة",
  multi: "X — رباعي",
};

// Theme colors (from bundle CSS)
export const COLORS = {
  bg: "#08090c",
  bg2: "#0c0e13",
  surface: "#0f1219",
  border: "#1a2030",
  borderHi: "#2a3545",
  led: "#ddeeff",
  ledGlow: "#c8e6ff8c",
  accent: "#3d87f5",
  accentDim: "#3d87f51f",
  text: "#aabbcc",
  textHi: "#ddeeff",
  muted: "#4a6070",
  amber: "#FFB830",
  node: "#3d87f5",
  nodeDark: "#1a4fa0",
  danger: "#ff6060",
};
