import { useEffect, useRef, useState } from "react";
import { Editor } from "../store";
import {
  buildGraph,
  Doc,
  hexCenter,
  hexId,
  hexVertices,
  lineActionAt,
  nearestLineHit,
  pitchMm,
  pixelToHex,
  proposeLine,
} from "../engine/geometry";
import { nodeInfos } from "../engine/bom";
import { CCT_BY_ID, COLORS } from "../engine/spec";

interface P {
  ed: Editor;
}

export default function Canvas({ ed }: P) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [moveOff, setMoveOff] = useState<{ dx: number; dy: number } | null>(null);
  const [paintDoc, setPaintDoc] = useState<Doc | null>(null);
  const [keys, setKeys] = useState(false);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null);
  const mv = useRef<{ x: number; y: number } | null>(null);
  const paint = useRef<{ erase: boolean; visited: Set<string>; moved: boolean; fx: number; fy: number } | null>(null);
  const work = useRef<Doc | null>(null);
  const space = useRef(false);
  const edRef = useRef(ed);
  edRef.current = ed;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // hold Space to pan instead of paint
  useEffect(() => {
    const isField = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
    };
    const d = (e: KeyboardEvent) => { if (e.code === "Space" && !isField(e.target)) { space.current = true; e.preventDefault(); } };
    const u = (e: KeyboardEvent) => { if (e.code === "Space") space.current = false; };
    window.addEventListener("keydown", d);
    window.addEventListener("keyup", u);
    return () => { window.removeEventListener("keydown", d); window.removeEventListener("keyup", u); };
  }, []);

  // 'F' key (handled in AppEditor) asks the canvas to fit
  useEffect(() => {
    const f = () => fit(ed, size);
    window.addEventListener("hl-fit", f);
    return () => window.removeEventListener("hl-fit", f);
  }, [ed, size]);

  const { view } = ed;

  // fit the view to the room footprint whenever room size or canvas size changes
  const roomW = ed.lux.roomWidthM * 1000;
  const roomD = ed.lux.roomHeightM * 1000;
  useEffect(() => {
    if (size.w === 0 || !(roomW > 0) || !(roomD > 0)) return;
    const pad = 80;
    const s = Math.min(2, Math.max(0.03, Math.min((size.w - pad * 2) / roomW, (size.h - pad * 2) / roomD)));
    // room is centred on the world origin
    ed.setView({ scale: s, tx: size.w / 2, ty: size.h / 2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomW, roomD, size.w, size.h]);

  const toWorld = (clientX: number, clientY: number) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return {
      x: (clientX - r.left - view.tx) / view.scale,
      y: (clientY - r.top - view.ty) / view.scale,
    };
  };
  const sx = (x: number) => x * view.scale + view.tx;
  const sy = (y: number) => y * view.scale + view.ty;

  // native non-passive wheel handler so Ctrl+wheel zooms the canvas, not the page
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const ed = edRef.current;
      const v = ed.view;
      const r = el.getBoundingClientRect();
      const cx = e.clientX - r.left, cy = e.clientY - r.top;
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.0025 : 0.0012));
      const ns = Math.min(2, Math.max(0.03, v.scale * factor));
      const wx = (cx - v.tx) / v.scale, wy = (cy - v.ty) / v.scale;
      ed.setView({ scale: ns, tx: cx - wx * ns, ty: cy - wy * ns });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // apply one cell into the working doc during a paint stroke
  const paintAt = (clientX: number, clientY: number) => {
    const p = paint.current;
    const w = work.current;
    if (!p || !w) return;
    const { x, y } = toWorld(clientX, clientY);
    if (ed.mode === "lines") {
      if (p.erase) {
        const hit = nearestLineHit(w, x, y);
        if (!hit || p.visited.has(hit)) return;
        p.visited.add(hit);
        delete w.lines[hit];
      } else {
        const prop = proposeLine(w, ed.lineSystem, x, y);
        if (p.visited.has(prop.seg.id)) return;
        p.visited.add(prop.seg.id);
        if (prop.legal && !prop.exists) w.lines[prop.seg.id] = prop.seg;
      }
    } else {
      const [q, r] = pixelToHex(ed.hexSystem, x, y);
      const id = hexId(ed.hexSystem, q, r);
      if (p.visited.has(id)) return;
      p.visited.add(id);
      if (p.erase) delete w.hexes[id];
      else w.hexes[id] = { id, systemId: ed.hexSystem, q, r };
    }
    setPaintDoc({ hexes: { ...w.hexes }, lines: { ...w.lines } });
  };

  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const wantPan = e.button === 1 || e.button === 2 || space.current;
    if (wantPan) {
      drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, moved: false };
      return;
    }
    if (ed.mode === "move") {
      mv.current = { x: e.clientX, y: e.clientY };
      setMoveOff({ dx: 0, dy: 0 });
      return;
    }
    // hex / lines: begin a paint stroke (commit happens on pointer up)
    work.current = { hexes: { ...ed.doc.hexes }, lines: { ...ed.doc.lines } };
    paint.current = { erase: e.shiftKey || e.altKey, visited: new Set(), moved: false, fx: e.clientX, fy: e.clientY };
  };

  const onMove = (e: React.PointerEvent) => {
    const w = toWorld(e.clientX, e.clientY);
    setHover(w);
    if (mv.current) {
      setMoveOff({ dx: e.clientX - mv.current.x, dy: e.clientY - mv.current.y });
      return;
    }
    if (drag.current) {
      const dx = e.clientX - drag.current.x;
      const dy = e.clientY - drag.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.current.moved = true;
      if (drag.current.moved) ed.setView({ ...view, tx: drag.current.tx + dx, ty: drag.current.ty + dy });
      return;
    }
    if (paint.current) {
      const d = Math.abs(e.clientX - paint.current.fx) + Math.abs(e.clientY - paint.current.fy);
      if (d > 4) {
        if (!paint.current.moved) {
          paint.current.moved = true;
          paintAt(paint.current.fx, paint.current.fy); // include the start cell
        }
        paintAt(e.clientX, e.clientY);
      }
    }
  };

  const onUp = (e: React.PointerEvent) => {
    if (mv.current) {
      const dx = e.clientX - mv.current.x;
      const dy = e.clientY - mv.current.y;
      mv.current = null;
      setMoveOff(null);
      ed.translateDoc(dx / view.scale, dy / view.scale);
      return;
    }
    if (drag.current) {
      drag.current = null;
      return;
    }
    if (paint.current) {
      const p = paint.current;
      paint.current = null;
      if (p.moved && work.current) {
        ed.setDoc(work.current); // one undo entry for the whole stroke
      } else {
        const w = toWorld(e.clientX, e.clientY);
        ed.placeAt(w.x, w.y); // plain click = toggle single cell
      }
      work.current = null;
      setPaintDoc(null);
    }
  };

  const g = buildGraph(paintDoc ?? ed.doc);
  const infos = nodeInfos(g);
  const shorten = 8.9; // barEndToConnectorCenterMm

  // hover preview
  let preview: JSX.Element | null = null;
  if (hover && !drag.current?.moved && ed.mode !== "move") {
    if (ed.mode === "hex") {
      const [q, r] = pixelToHex(ed.hexSystem, hover.x, hover.y);
      const v = hexVertices(ed.hexSystem, q, r);
      const pts = v.map(([x, y]) => `${sx(x)},${sy(y)}`).join(" ");
      preview = <polygon points={pts} fill={COLORS.accentDim} stroke={COLORS.accent} strokeWidth={1.5} strokeDasharray="4 4" />;
    } else {
      const act = lineActionAt(paintDoc ?? ed.doc, ed.lineSystem, hover.x, hover.y);
      const seg = act.seg;
      const col = act.kind === "remove" ? COLORS.amber : act.kind === "add" ? COLORS.accent : COLORS.danger;
      preview = (
        <>
          <line
            x1={sx(seg.ax)} y1={sy(seg.ay)} x2={sx(seg.bx)} y2={sy(seg.by)}
            stroke={col} strokeWidth={6} strokeDasharray="6 6" strokeLinecap="round" opacity={0.75}
          />
          <circle cx={sx(seg.ax)} cy={sy(seg.ay)} r={4} fill={col} />
        </>
      );
    }
  }

  // bar thickness in px from a fixed mm width, clamped
  const barPx = Math.max(3, Math.min(14, 26 * view.scale));

  // LED colour from the selected CCT / RGBIC mode
  const cct = CCT_BY_ID[ed.cctId] ?? CCT_BY_ID["6500"];
  const ledStroke = cct.rgbic ? "url(#rgbic)" : cct.color;

  // placement markers: power cords (always) + hangers (suspended only)
  const suspended = ed.lux.mountingMode === "suspended";
  const HANGER = "#7df0ff";

  return (
    <div ref={wrapRef} className="canvas-wrap">
      <svg
        width={size.w}
        height={size.h}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          touchAction: "none",
          display: "block",
          cursor: moveOff ? "grabbing" : ed.mode === "move" ? "move" : drag.current?.moved ? "grabbing" : "crosshair",
        }}
      >
        <defs>
          <filter id="ledglow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={barPx * 0.5} result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="rgbic" x1="0" y1="0" x2="320" y2="0" gradientUnits="userSpaceOnUse" spreadMethod="repeat">
            <stop offset="0" stopColor="#ff4d4d" />
            <stop offset="0.17" stopColor="#ffb030" />
            <stop offset="0.34" stopColor="#ffe84d" />
            <stop offset="0.5" stopColor="#4dff7a" />
            <stop offset="0.67" stopColor="#4dd2ff" />
            <stop offset="0.84" stopColor="#7a6bff" />
            <stop offset="1" stopColor="#ff4dd2" />
            <animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="320 0" dur="6s" repeatCount="indefinite" />
          </linearGradient>
        </defs>

        <BackdropGrid size={size} view={view} hexSystem={ed.hexSystem} lineSystem={ed.lineSystem} mode={ed.mode} sx={sx} sy={sy} />

        <RoomOverlay w={ed.lux.roomWidthM} d={ed.lux.roomHeightM} scale={view.scale} sx={sx} sy={sy} />

        {preview}

        <g transform={moveOff ? `translate(${moveOff.dx} ${moveOff.dy})` : undefined}>
        {/* bars */}
        <g filter="url(#ledglow)">
          {[...g.edges.values()].map((e) => {
            const a = g.nodes.get(e.from)!;
            const b = g.nodes.get(e.to)!;
            const dx = b.x - a.x,
              dy = b.y - a.y;
            const L = Math.hypot(dx, dy) || 1;
            const ux = dx / L,
              uy = dy / L;
            const ax = a.x + ux * shorten,
              ay = a.y + uy * shorten;
            const bx = b.x - ux * shorten,
              by = b.y - uy * shorten;
            return (
              <line key={e.key}
                x1={sx(ax)} y1={sy(ay)} x2={sx(bx)} y2={sy(by)}
                stroke={ledStroke} strokeWidth={barPx} strokeLinecap="round"
              />
            );
          })}
        </g>

        {/* connectors */}
        {[...infos.values()].map((n) => {
          if (n.type === null) {
            return <circle key={n.key} cx={sx(n.x)} cy={sy(n.y)} r={barPx * 0.42} fill={COLORS.nodeDark} />;
          }
          const power = n.type === "t";
          const rad = barPx * (n.type === "multi" ? 0.78 : 0.62);
          return (
            <g key={n.key}>
              <circle cx={sx(n.x)} cy={sy(n.y)} r={rad + 1.5} fill={power ? COLORS.amber : COLORS.node} />
              <circle cx={sx(n.x)} cy={sy(n.y)} r={rad} fill={COLORS.surface} stroke={power ? COLORS.amber : COLORS.node} strokeWidth={1.5} />
            </g>
          );
        })}

        {/* hanger anchors (suspended mount) — cable up to ceiling */}
        {suspended && ed.bom.hangerPoints.map((p, i) => {
          const cx = sx(p.x), cy = sy(p.y), h = barPx * 2.6;
          return (
            <g key={`hg${i}`} pointerEvents="none">
              <line x1={cx} y1={cy} x2={cx} y2={cy - h} stroke={HANGER} strokeWidth={1.4} strokeDasharray="3 2" />
              <line x1={cx - barPx * 0.55} y1={cy - h} x2={cx + barPx * 0.55} y2={cy - h} stroke={HANGER} strokeWidth={2.2} strokeLinecap="round" />
              <circle cx={cx} cy={cy} r={barPx * 0.34} fill={HANGER} />
            </g>
          );
        })}

        {/* power cord plug points (always) */}
        {ed.bom.powerPoints.map((p, i) => {
          const cx = sx(p.x), cy = sy(p.y), r = barPx * 0.62;
          return (
            <g key={`pw${i}`} pointerEvents="none">
              <circle cx={cx} cy={cy} r={r + 2} fill={COLORS.amber} />
              <circle cx={cx} cy={cy} r={r} fill={COLORS.bg} stroke={COLORS.amber} strokeWidth={1.5} />
              <text x={cx} y={cy} fill={COLORS.amber} fontSize={r * 1.5} textAnchor="middle" dominantBaseline="central">⚡</text>
            </g>
          );
        })}
        </g>
      </svg>

      <div className="canvas-hud">
        <span>{ed.bom.totalSegments} ضلع</span>
        <span>·</span>
        <span>{Math.round(view.scale * 1000) / 10} بكسل/م</span>
        <button className="hud-btn" onClick={() => fit(ed, size)}>ملاءمة</button>
        <button className="hud-btn ghost" onClick={() => copyLayout(ed)} title="نسخ التصميم كقالب">نسخ</button>
        <button className="hud-btn ghost" onClick={() => setKeys((v) => !v)} title="الاختصارات">⌨</button>
      </div>

      {keys && (
        <div className="keys-panel" onClick={() => setKeys(false)}>
          <h4>الاختصارات</h4>
          <ul>
            <li><b>سحب</b> رسم الخلايا</li>
            <li><b>Shift / Alt + سحب</b> مسح</li>
            <li><b>نقر</b> تبديل خلية</li>
            <li><b>يمين / أوسط / Space + سحب</b> تحريك العرض</li>
            <li><b>عجلة الفأرة</b> تكبير</li>
            <li><b>H / L / M</b> سداسي · خطوط · تحريك</li>
            <li><b>1 / 2</b> حجم الضلع</li>
            <li><b>O</b> الاتجاه · <b>F</b> ملاءمة</li>
            <li><b>⌘/Ctrl+Z</b> تراجع · <b>+Shift</b> إعادة</li>
            <li><b>Shift+C</b> مسح</li>
          </ul>
        </div>
      )}
    </div>
  );
}

// serialize the current layout so a template can be added verbatim to the app
function copyLayout(ed: Editor) {
  const hex: Record<string, [number, number][]> = {};
  for (const h of Object.values(ed.doc.hexes)) (hex[h.systemId] ||= []).push([h.q, h.r]);
  const lines = Object.values(ed.doc.lines).map((l) => [Math.round(l.ax), Math.round(l.ay), Math.round(l.bx), Math.round(l.by)]);
  const out = JSON.stringify({ hex, lines });
  navigator.clipboard?.writeText(out).then(
    () => alert("تم نسخ التصميم — الصقه في المحادثة مع اسم القالب."),
    () => window.prompt("انسخ هذا التصميم:", out),
  );
}

function fit(ed: Editor, size: { w: number; h: number }) {
  const g = buildGraph(ed.doc);
  if (g.nodes.size === 0) {
    ed.setView({ scale: 0.18, tx: size.w / 2, ty: size.h / 2 });
    return;
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of g.nodes.values()) {
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y);
  }
  const pad = 60;
  const w = maxX - minX || 1, h = maxY - minY || 1;
  const scale = Math.min((size.w - pad * 2) / w, (size.h - pad * 2) / h);
  const s = Math.min(2, Math.max(0.03, scale));
  ed.setView({ scale: s, tx: size.w / 2 - ((minX + maxX) / 2) * s, ty: size.h / 2 - ((minY + maxY) / 2) * s });
}

// Room footprint overlay, centred on the world origin. Dimensions in metres.
function RoomOverlay({
  w, d, scale, sx, sy,
}: {
  w: number; d: number; scale: number;
  sx: (x: number) => number; sy: (y: number) => number;
}) {
  if (!(w > 0) || !(d > 0)) return null;
  const halfW = (w * 1000) / 2;
  const halfD = (d * 1000) / 2;
  const x = sx(-halfW), y = sy(-halfD);
  const pw = w * 1000 * scale, ph = d * 1000 * scale;
  return (
    <g pointerEvents="none">
      <rect x={x} y={y} width={pw} height={ph} fill="none" stroke={COLORS.accent}
        strokeWidth={1.5} strokeDasharray="8 6" rx={4} />
      <text x={x + pw / 2} y={y - 8} fill={COLORS.accent} fontSize={13} textAnchor="middle"
        fontFamily="IBM Plex Sans Arabic, sans-serif" letterSpacing={0.5}>
        غرفة {w.toFixed(1)} × {d.toFixed(1)} م
      </text>
      <text x={x + 6} y={y + ph - 6} fill={COLORS.muted} fontSize={11} fontFamily="IBM Plex Sans Arabic, sans-serif">
        {(w * d).toFixed(1)} م²
      </text>
    </g>
  );
}

function BackdropGrid({
  size, view, hexSystem, lineSystem, mode, sx, sy,
}: {
  size: { w: number; h: number };
  view: { scale: number; tx: number; ty: number };
  hexSystem: string;
  lineSystem: string;
  mode: "hex" | "lines" | "move";
  sx: (x: number) => number;
  sy: (y: number) => number;
}) {
  // world bounds of the viewport
  const w0x = (0 - view.tx) / view.scale;
  const w0y = (0 - view.ty) / view.scale;
  const w1x = (size.w - view.tx) / view.scale;
  const w1y = (size.h - view.ty) / view.scale;

  // --- ghost hexagon placeholders (always shown, orientation-aware) ---
  const R = pitchMm(hexSystem);
  const pad = R;
  const cells: JSX.Element[] = [];
  const MAX_CELLS = 3000;
  if (R * view.scale >= 5) {
    // axial range from the four viewport corners
    let qMin = Infinity, qMax = -Infinity, rMin = Infinity, rMax = -Infinity;
    for (const [cx, cy] of [[w0x, w0y], [w1x, w0y], [w0x, w1y], [w1x, w1y]] as const) {
      const [aq, ar] = pixelToHex(hexSystem, cx, cy);
      qMin = Math.min(qMin, aq); qMax = Math.max(qMax, aq);
      rMin = Math.min(rMin, ar); rMax = Math.max(rMax, ar);
    }
    qMin -= 1; qMax += 1; rMin -= 1; rMax += 1;
    // thinner stroke as hexes shrink, so a zoomed-out field stays legible
    const stroke = R * view.scale < 10 ? 1 : 2;
    outer: for (let r = rMin; r <= rMax; r++) {
      for (let q = qMin; q <= qMax; q++) {
        const [cx, cy] = hexCenter(hexSystem, q, r);
        if (cx < w0x - pad || cx > w1x + pad || cy < w0y - pad || cy > w1y + pad) continue;
        const pts = hexVertices(hexSystem, q, r).map(([x, y]) => `${sx(x)},${sy(y)}`).join(" ");
        cells.push(
          <polygon key={`${q},${r}`} points={pts} fill="none" stroke={COLORS.border} strokeWidth={stroke} />,
        );
        if (cells.length >= MAX_CELLS) break outer;
      }
    }
  }

  // --- line lattice dots (only in lines mode) ---
  const dots: JSX.Element[] = [];
  if (mode === "lines") {
    const L = pitchMm(lineSystem);
    if (L * view.scale >= 12) {
      const lp = L;
      const i0 = Math.floor((w0x - lp) / L), i1 = Math.ceil((w1x + lp) / L);
      const j0 = Math.floor((w0y - lp) / L), j1 = Math.ceil((w1y + lp) / L);
      if ((i1 - i0) * (j1 - j0) <= 4000) {
        for (let i = i0; i <= i1; i++)
          for (let j = j0; j <= j1; j++)
            dots.push(<circle key={`d${i}-${j}`} cx={sx(i * L)} cy={sy(j * L)} r={2.2} fill={COLORS.borderHi} />);
      }
    }
  }

  return (
    <>
      <g opacity={0.55}>{cells}</g>
      {dots.length > 0 && <g opacity={0.9}>{dots}</g>}
    </>
  );
}
