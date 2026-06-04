import jsPDF from "jspdf";
import { Doc } from "./geometry";
import { computeBom } from "./bom";
import { computeLux, LuxInput } from "./lux";
import { BarConfig, CONNECTOR_LABELS, defaultBarConfig } from "./spec";

export function exportPdf(doc: Doc, lux: LuxInput, clusterExtentM: number, config: BarConfig = defaultBarConfig(), name = "Untitled layout") {
  const bom = computeBom(doc, config);
  const lx = computeLux(doc, { ...lux, clusterExtentM }, config);
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const M = 18;
  let y = M;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text(`Hexlight — ${name}`, M, y);
  y += 8;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(120);
  pdf.text(new Date().toLocaleString(), M, y);
  pdf.setTextColor(0);
  y += 10;

  const head = (t: string) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text(t, M, y);
    y += 6;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
  };
  const line = (l: string, r: string) => {
    pdf.text(l, M, y);
    pdf.text(r, 192, y, { align: "right" });
    y += 6;
  };

  head("Bars");
  if (!bom.segmentGroups.length) line("(empty)", "");
  bom.segmentGroups.forEach((s) => line(`${s.label} bar`, `${s.count}`));
  y += 2;

  head("Connectors");
  if (!bom.connectorCounts.length) line("(none)", "");
  bom.connectorCounts.forEach((c) => line(CONNECTOR_LABELS[c.type], `${c.count}`));
  y += 2;

  head("Power");
  line("Total load", `${bom.power.totalWatts} W`);
  line("Runs", `${bom.power.runs}`);
  line("Power inputs (<=420 W each)", `${bom.power.powerInputs}`);
  y += 2;

  head("Light check");
  line("Space", lx.useCaseLabel);
  line("Target", `${lx.targetLux} lx (${lx.rangeLow}-${lx.rangeHigh})`);
  line("Estimate", lx.luxEstimate == null ? "—" : `${lx.luxEstimate} lx (${lx.zone})`);
  y += 4;

  pdf.setDrawColor(200);
  pdf.line(M, y, 192, y);
  y += 8;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  line("Estimated price", `$${bom.estimatedPrice}`);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(140);
  pdf.text("Lux is a ±20% lumen-method estimate (MF 0.80) against EN 12464-1 targets.", M, 285);

  const safe = name.trim().replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "") || "hexlight-layout";
  pdf.save(`${safe}.pdf`);
}
