import { useEffect, useRef, useState } from "react";
import { Editor } from "../store";
import {
  buildGraph,
  hexVertices,
  pixelToHex,
  nearestLineEdge,
} from "../engine/geometry";
import { nodeInfos } from "../engine/bom";
import { COLORS, SYSTEM_BY_ID } from "../engine/spec";

interface P {
  ed: Editor;
}

export default function Canvas({ ed }: P) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [moveOff, setMoveOff] = useState<{ dx: number; dy: number } | null>(null);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null);
  const mv = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const { view } = ed;
  const toWorld = (clientX: number, clientY: number) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return {
      x: (clientX - r.left - view.tx) / view.scale,
      y: (clientY - r.top - view.ty) / view.scale,
    };
  };
  const sx = (x: number) => x * view.scale + view.tx;
  const sy = (y: number) => y * view.scale + view.ty;

  // wheel zoom around cursor
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const r = wrapRef.current!.getBoundingClientRect();
    const cx = e.clientX - r.left,
      cy = e.clientY - r.top;
    const factor = Math.exp(-e.deltaY * 0.0012);
    const ns = Math.min(2, Math.max(0.03, view.scale * factor));
    // keep world point under cursor fixed
    const wx = (cx - view.tx) / view.scale;
    const wy = (cy - view.ty) / view.scale;
    ed.setView({ scale: ns, tx: cx - wx * ns, ty: cy - wy * ns });
  };

  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (ed.mode === "move") {
      mv.current = { x: e.clientX, y: e.clientY };
      setMoveOff({ dx: 0, dy: 0 });
    } else {
      drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, moved: false };
    }
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
      if (drag.current.moved)
        ed.setView({ ...view, tx: drag.current.tx + dx, ty: drag.current.ty + dy });
    }
  };
  const onUp = (e: React.PointerEvent) => {
    if (mv.current) {
      const dx = e.clientX - mv.current.x;
      const dy = e.clientY - mv.current.y;
      mv.current = null;
      setMoveOff(null);
      // screen px -> world mm
      ed.translateDoc(dx / view.scale, dy / view.scale);
      return;
    }
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) {
      const w = toWorld(e.clientX, e.clientY);
      ed.placeAt(w.x, w.y);
    }
  };

  const g = buildGraph(ed.doc);
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
      const seg = nearestLineEdge("line1176", hover.x, hover.y);
      preview = (
        <line
          x1={sx(seg.ax)} y1={sy(seg.ay)} x2={sx(seg.bx)} y2={sy(seg.by)}
          stroke={COLORS.accent} strokeWidth={6} strokeDasharray="6 6" strokeLinecap="round" opacity={0.6}
        />
      );
    }
  }

  // bar thickness in px from a fixed mm width, clamped
  const barPx = Math.max(3, Math.min(14, 26 * view.scale));

  return (
    <div ref={wrapRef} className="canvas-wrap" onWheel={onWheel}>
      <svg
        width={size.w}
        height={size.h}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
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
        </defs>

        <BackdropGrid size={size} view={view} system={ed.activeSystem} mode={ed.mode} sx={sx} sy={sy} />

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
                stroke={COLORS.led} strokeWidth={barPx} strokeLinecap="round"
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
        </g>
      </svg>

      <div className="canvas-hud">
        <span>{ed.bom.totalSegments} bars</span>
        <span>·</span>
        <span>{Math.round(view.scale * 1000) / 10} px/m</span>
        <button className="hud-btn" onClick={() => fit(ed, size)}>Fit</button>
      </div>
    </div>
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

function BackdropGrid({
  size, view, system, mode, sx, sy,
}: {
  size: { w: number; h: number };
  view: { scale: number; tx: number; ty: number };
  system: string;
  mode: "hex" | "lines" | "move";
  sx: (x: number) => number;
  sy: (y: number) => number;
}) {
  const R = SYSTEM_BY_ID[system].segmentLength;

  // world bounds of the viewport
  const w0x = (0 - view.tx) / view.scale;
  const w0y = (0 - view.ty) / view.scale;
  const w1x = (size.w - view.tx) / view.scale;
  const w1y = (size.h - view.ty) / view.scale;
  const pad = R; // one cell margin

  if (mode === "lines") {
    // square lattice of bar-length cells
    const stepPx = R * view.scale;
    if (stepPx < 10) return null;
    const lines: JSX.Element[] = [];
    const i0 = Math.floor((w0x - pad) / R), i1 = Math.ceil((w1x + pad) / R);
    const j0 = Math.floor((w0y - pad) / R), j1 = Math.ceil((w1y + pad) / R);
    if ((i1 - i0) * (j1 - j0) > 4000) return null;
    for (let i = i0; i <= i1; i++)
      lines.push(<line key={`v${i}`} x1={sx(i * R)} y1={sy(j0 * R)} x2={sx(i * R)} y2={sy(j1 * R)} stroke={COLORS.border} strokeWidth={1} />);
    for (let j = j0; j <= j1; j++)
      lines.push(<line key={`h${j}`} x1={sx(i0 * R)} y1={sy(j * R)} x2={sx(i1 * R)} y2={sy(j * R)} stroke={COLORS.border} strokeWidth={1} />);
    return <g opacity={0.6}>{lines}</g>;
  }

  // ghost hexagon placeholders (pointy-top), like the real app
  if (R * view.scale < 14) return null; // too zoomed out
  const SQRT3 = Math.sqrt(3);
  const rOf = (y: number) => y / (1.5 * R);
  const qOf = (x: number, r: number) => x / (R * SQRT3) - r / 2;
  const rMin = Math.floor(rOf(w0y - pad)) - 1;
  const rMax = Math.ceil(rOf(w1y + pad)) + 1;
  if (rMax - rMin > 120) return null;

  const cells: JSX.Element[] = [];
  for (let r = rMin; r <= rMax; r++) {
    const qMin = Math.floor(qOf(w0x - pad, r)) - 1;
    const qMax = Math.ceil(qOf(w1x + pad, r)) + 1;
    if (qMax - qMin > 200) return null;
    for (let q = qMin; q <= qMax; q++) {
      const cx = R * SQRT3 * (q + r / 2);
      const cy = R * 1.5 * r;
      if (cx < w0x - pad || cx > w1x + pad || cy < w0y - pad || cy > w1y + pad) continue;
      const pts: string[] = [];
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 180) * (60 * k - 90);
        pts.push(`${sx(cx + R * Math.cos(a))},${sy(cy + R * Math.sin(a))}`);
      }
      cells.push(
        <polygon key={`${q},${r}`} points={pts.join(" ")} fill="none" stroke={COLORS.border} strokeWidth={1} />,
      );
    }
    if (cells.length > 1800) break;
  }
  return <g opacity={0.55}>{cells}</g>;
}
