import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Doc, buildGraph } from "./geometry";
import { computeBom } from "./bom";
import { computeLux, LuxInput } from "./lux";
import { BarConfig, CCT_BY_ID, CONNECTOR_LABELS, defaultBarConfig } from "./spec";

const SITE = "https://147hex.pages.dev";

// Build an SVG of the layout (dark panel, glowing bars) for the report.
function layoutSvg(doc: Doc, cctId: string, powerPoints: { x: number; y: number }[], hangerPoints: { x: number; y: number }[]): string {
  const g = buildGraph(doc);
  if (g.nodes.size === 0) {
    return `<div style="display:flex;align-items:center;justify-content:center;height:320px;color:#4a6070">— تصميم فارغ —</div>`;
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of g.nodes.values()) {
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y);
  }
  const pad = Math.max(maxX - minX, maxY - minY) * 0.08 + 40;
  const W = maxX - minX + pad * 2, H = maxY - minY + pad * 2;
  const vb = `${minX - pad} ${minY - pad} ${W} ${H}`;
  const sw = Math.max(W, H) * 0.012;
  const cct = CCT_BY_ID[cctId] ?? CCT_BY_ID["6500"];
  const led = cct.rgbic ? "url(#pdf-rgbic)" : cct.color;
  const glow = cct.rgbic ? "#7df0ff" : cct.color;
  const period = Math.max(W, H) * 0.5; // rainbow repeat span in world units
  const rgbicDef = cct.rgbic
    ? `<defs><linearGradient id="pdf-rgbic" x1="${minX}" y1="${minY}" x2="${minX + period}" y2="${minY}" gradientUnits="userSpaceOnUse" spreadMethod="repeat">
        <stop offset="0" stop-color="#ff4d4d"/><stop offset="0.17" stop-color="#ffb030"/><stop offset="0.34" stop-color="#ffe84d"/><stop offset="0.5" stop-color="#4dff7a"/><stop offset="0.67" stop-color="#4dd2ff"/><stop offset="0.84" stop-color="#7a6bff"/><stop offset="1" stop-color="#ff4dd2"/>
      </linearGradient></defs>`
    : "";
  const shorten = 8.9;

  let bars = "";
  for (const e of g.edges.values()) {
    const a = g.nodes.get(e.from)!, b = g.nodes.get(e.to)!;
    const dx = b.x - a.x, dy = b.y - a.y;
    const L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L;
    bars += `<line x1="${a.x + ux * shorten}" y1="${a.y + uy * shorten}" x2="${b.x - ux * shorten}" y2="${b.y - uy * shorten}" stroke="${led}" stroke-width="${sw}" stroke-linecap="round"/>`;
  }
  let nodes = "";
  for (const n of g.nodes.values()) {
    nodes += `<circle cx="${n.x}" cy="${n.y}" r="${sw * 1.1}" fill="#3d87f5"/>`;
  }
  const mr = sw * 2.4; // marker radius
  let hangers = "";
  for (const p of hangerPoints) {
    const h = mr * 2.2;
    hangers += `<line x1="${p.x}" y1="${p.y}" x2="${p.x}" y2="${p.y - h}" stroke="#7df0ff" stroke-width="${sw * 0.7}" stroke-dasharray="${sw} ${sw * 0.7}"/><line x1="${p.x - mr}" y1="${p.y - h}" x2="${p.x + mr}" y2="${p.y - h}" stroke="#7df0ff" stroke-width="${sw}" stroke-linecap="round"/><circle cx="${p.x}" cy="${p.y}" r="${mr * 0.5}" fill="#7df0ff"/>`;
  }
  let powers = "";
  for (const p of powerPoints) {
    powers += `<circle cx="${p.x}" cy="${p.y}" r="${mr + sw * 0.4}" fill="#FFB830"/><circle cx="${p.x}" cy="${p.y}" r="${mr}" fill="#0b0e14" stroke="#FFB830" stroke-width="${sw * 0.6}"/><text x="${p.x}" y="${p.y}" fill="#FFB830" font-size="${mr * 1.5}" text-anchor="middle" dominant-baseline="central">⚡</text>`;
  }
  return `<svg viewBox="${vb}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:340px;display:block">
    ${rgbicDef}
    <rect x="${minX - pad}" y="${minY - pad}" width="${W}" height="${H}" fill="#0b0e14"/>
    <g style="filter:drop-shadow(0 0 ${sw * 1.4}px ${glow}aa)">${bars}</g>${nodes}${hangers}${powers}
  </svg>`;
}

function table(rows: [string, string | number][]): string {
  return `<table style="width:100%;border-collapse:collapse;font-size:13px">${rows
    .map(
      ([l, v]) =>
        `<tr><td style="padding:5px 0;border-bottom:1px solid #e6eaf0;color:#3a4658">${l}</td><td style="padding:5px 0;border-bottom:1px solid #e6eaf0;text-align:left;color:#0c0e13;font-weight:600">${v}</td></tr>`,
    )
    .join("")}</table>`;
}

export async function exportPdf(
  doc: Doc,
  lux: LuxInput,
  clusterExtentM: number,
  config: BarConfig = defaultBarConfig(),
  name = "تصميم بدون اسم",
  cctId = "6500",
) {
  const bom = computeBom(doc, config, cctId === "rgbic");
  const lx = computeLux(doc, { ...lux, clusterExtentM }, config);
  const now = new Date().toLocaleString("ar-EG");

  const barsRows = bom.segmentGroups.map((s) => [`ضلع ${s.label}`, `× ${s.count}`] as [string, string]);
  const connRows = bom.connectorCounts.map((c) => [CONNECTOR_LABELS[c.type], `× ${c.count}`] as [string, string]);
  const luxLine = lx.luxEstimate == null ? "—" : `${lx.luxEstimate} لكس (${lx.rangeLow}–${lx.rangeHigh})`;

  const el = document.createElement("div");
  el.dir = "rtl";
  el.style.cssText =
    "position:fixed;top:0;right:0;width:760px;background:#fff;color:#0c0e13;" +
    "font-family:'IBM Plex Sans Arabic',sans-serif;padding:30px;box-sizing:border-box;z-index:-1;";
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">
      <div>
        <div style="font-size:13px;color:#3d87f5;font-weight:700">هكسلايت — مخطّط الإضاءة السداسية</div>
        <div style="font-size:26px;font-weight:700;margin-top:4px">${escapeHtml(name)}</div>
        <div style="font-size:12px;color:#7a8aa0;margin-top:4px">${now}</div>
      </div>
      <div style="text-align:left;font-size:12px;color:#7a8aa0">
        <div>المساحة: ${escapeHtml(lx.useCaseLabel)}</div>
        <div>الغرفة: ${lux.roomWidthM} × ${lux.roomHeightM} م</div>
      </div>
    </div>

    <div style="border:1px solid #e6eaf0;border-radius:10px;overflow:hidden;margin-bottom:18px">
      ${layoutSvg(doc, cctId, bom.powerPoints, lux.mountingMode === "suspended" ? bom.hangerPoints : [])}
    </div>

    <div style="display:flex;gap:24px;margin-bottom:16px">
      <div style="flex:1">
        <div style="font-size:12px;color:#7a8aa0;margin-bottom:6px">الأضلاع</div>
        ${barsRows.length ? table(barsRows) : '<div style="color:#7a8aa0;font-size:13px">—</div>'}
      </div>
      <div style="flex:1">
        <div style="font-size:12px;color:#7a8aa0;margin-bottom:6px">الموصلات</div>
        ${connRows.length ? table(connRows) : '<div style="color:#7a8aa0;font-size:13px">—</div>'}
      </div>
    </div>

    <div style="margin-bottom:16px">
      <div style="font-size:12px;color:#7a8aa0;margin-bottom:6px">الطاقة وفحص الإضاءة</div>
      ${table([
        ["إجمالي الحمل", `${bom.power.totalWatts} واط`],
        ["مداخل الطاقة (≤420 واط لكل مدخل)", bom.power.powerInputs],
        ...(lux.mountingMode === "suspended"
          ? ([["أسلاك التعليق", bom.suspensionPoints]] as [string, number][])
          : []),
        ["الهدف", `${lx.targetLux} لكس`],
        ["التقدير", luxLine],
      ])}
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;border-top:2px solid #0c0e13;padding-top:12px">
      <div style="font-size:20px;font-weight:700">السعر التقديري</div>
      <div style="font-size:20px;font-weight:700;color:#3d87f5">${bom.estimatedPrice.toLocaleString("en-US")} د.ع</div>
    </div>

    <div id="pdf-foot" style="margin-top:20px;padding-top:12px;border-top:1px solid #e6eaf0;font-size:12px;color:#7a8aa0;display:flex;justify-content:space-between">
      <span>تقدير ±20٪ بطريقة اللومن (عامل صيانة 0.80) مقابل أهداف EN 12464-1.</span>
      <span>تم الإنشاء عبر <span dir="ltr" style="color:#3d87f5;font-weight:600">147hex.pages.dev</span></span>
    </div>`;

  document.body.appendChild(el);
  try {
    if ((document as any).fonts?.ready) await (document as any).fonts.ready;
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
    const reportH = el.offsetHeight;

    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = 210, pageH = 297, margin = 12;
    const maxW = pageW - margin * 2, maxH = pageH - margin * 2;
    let w = maxW, h = (canvas.height / canvas.width) * maxW;
    if (h > maxH) { h = maxH; w = (canvas.width / canvas.height) * maxH; }
    const x = (pageW - w) / 2;
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", x, margin, w, h);

    // clickable link over the footer region
    const footH = (40 / reportH) * h;
    pdf.link(x, margin + h - footH, w, footH, { url: SITE });

    const safe = name.trim().replace(/[^\w؀-ۿ-]+/g, "-").replace(/^-+|-+$/g, "") || "hexlight";
    pdf.save(`${safe}.pdf`);
  } finally {
    document.body.removeChild(el);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}
