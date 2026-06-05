import { Doc, buildGraph } from "./geometry";
import { computeBom } from "./bom";
import { computeLux, LuxInput } from "./lux";
import { BarConfig, CCT_BY_ID, CONNECTOR_LABELS, defaultBarConfig } from "./spec";

const SITE = "https://147hex.pages.dev";

// Build an SVG of the layout (dark panel, glowing bars) for the report.
type Mk = { x: number; y: number; dx: number; dy: number };
function layoutSvg(doc: Doc, cctId: string, powerPoints: Mk[], hangerPoints: Mk[]): string {
  const g = buildGraph(doc);
  if (g.nodes.size === 0) {
    return `<div style="display:flex;align-items:center;justify-content:center;height:320px;color:#4a6070">— تصميم فارغ —</div>`;
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of g.nodes.values()) {
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y);
  }
  // bar pitch (median edge length) — size everything off this so markers stay
  // proportional to the bars regardless of how large the grid is.
  const lens: number[] = [];
  for (const e of g.edges.values()) {
    const a = g.nodes.get(e.from)!, b = g.nodes.get(e.to)!;
    lens.push(Math.hypot(b.x - a.x, b.y - a.y));
  }
  lens.sort((x, y) => x - y);
  const pitch = lens.length ? lens[Math.floor(lens.length / 2)] : 500;

  const pad = pitch * 0.7 + 20;
  const W = maxX - minX + pad * 2, H = maxY - minY + pad * 2;
  const vb = `${minX - pad} ${minY - pad} ${W} ${H}`;
  const sw = pitch * 0.06;            // bar thickness
  const nodeR = sw * 1.2;
  const mr = pitch * 0.15;            // marker icon radius
  const cct = CCT_BY_ID[cctId] ?? CCT_BY_ID["6500"];
  // print-readable on a light panel: rainbow for RGBIC, dark ink otherwise
  const led = cct.rgbic ? "url(#pdf-rgbic)" : "#26324a";
  const AMBER = "#cf7a00", TEAL = "#0c8aa3";
  const rgbicDef = cct.rgbic
    ? `<defs><linearGradient id="pdf-rgbic" x1="${minX}" y1="${minY}" x2="${minX + pitch * 6}" y2="${minY}" gradientUnits="userSpaceOnUse" spreadMethod="repeat">
        <stop offset="0" stop-color="#ff4d4d"/><stop offset="0.17" stop-color="#ff9e1f"/><stop offset="0.34" stop-color="#e8c800"/><stop offset="0.5" stop-color="#26c455"/><stop offset="0.67" stop-color="#1aa6e0"/><stop offset="0.84" stop-color="#6a55e8"/><stop offset="1" stop-color="#e84dc0"/>
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
    nodes += `<circle cx="${n.x}" cy="${n.y}" r="${nodeR}" fill="#3d6fb5"/>`;
  }
  let hangers = "";
  for (const p of hangerPoints) {
    const off = mr * 1.7, ox = p.x + p.dx * off, oy = p.y + p.dy * off, h = mr * 1.6;
    hangers += `<line x1="${p.x}" y1="${p.y}" x2="${ox}" y2="${oy}" stroke="${TEAL}" stroke-width="${sw * 0.7}"/><circle cx="${p.x}" cy="${p.y}" r="${sw}" fill="${TEAL}"/><line x1="${ox}" y1="${oy}" x2="${ox}" y2="${oy - h}" stroke="${TEAL}" stroke-width="${sw * 0.9}" stroke-dasharray="${sw * 1.3} ${sw}"/><line x1="${ox - mr * 0.8}" y1="${oy - h}" x2="${ox + mr * 0.8}" y2="${oy - h}" stroke="${TEAL}" stroke-width="${sw * 1.2}" stroke-linecap="round"/><circle cx="${ox}" cy="${oy}" r="${mr * 0.42}" fill="${TEAL}"/>`;
  }
  let powers = "";
  for (const p of powerPoints) {
    const off = mr * 1.5, ox = p.x + p.dx * off, oy = p.y + p.dy * off;
    powers += `<line x1="${p.x}" y1="${p.y}" x2="${ox}" y2="${oy}" stroke="${AMBER}" stroke-width="${sw * 0.8}"/><circle cx="${p.x}" cy="${p.y}" r="${sw}" fill="${AMBER}"/><circle cx="${ox}" cy="${oy}" r="${mr}" fill="#fff" stroke="${AMBER}" stroke-width="${sw * 0.9}"/><text x="${ox}" y="${oy}" fill="${AMBER}" font-size="${mr * 1.5}" text-anchor="middle" dominant-baseline="central">⚡</text>`;
  }
  return `<svg viewBox="${vb}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:340px;display:block;background:#ffffff">
    ${rgbicDef}
    ${bars}${nodes}${hangers}${powers}
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
  // lazy-loaded so jspdf + html2canvas stay out of the main bundle
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
  ]);

  const bom = computeBom(doc, config, cctId === "rgbic", lux.mountingMode === "suspended");
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
      <div style="font-size:11px;color:#7a8aa0;font-style:italic;margin-top:8px">تقدير ±20٪ بطريقة اللومن (عامل صيانة 0.80) مقابل أهداف EN 12464-1. ليس بديلاً عن محاكاة ضوئية دقيقة.</div>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;border-top:2px solid #0c0e13;padding-top:12px">
      <div style="font-size:20px;font-weight:700">السعر التقديري</div>
      <div style="font-size:20px;font-weight:700;color:#3d87f5">${bom.estimatedPrice.toLocaleString("en-US")} د.ع</div>
    </div>

    <div id="pdf-foot" style="margin-top:20px;padding-top:12px;border-top:1px solid #e6eaf0;font-size:12px;color:#7a8aa0;display:flex;justify-content:flex-end">
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
