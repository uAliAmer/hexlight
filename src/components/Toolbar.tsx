import { useState } from "react";
import { Editor } from "../store";
import { COLORS, SYSTEMS } from "../engine/spec";
import { TEMPLATES } from "../engine/templates";
import BarConfig from "./BarConfig";

export default function Toolbar({ ed, onExport }: { ed: Editor; onExport: () => void }) {
  const [cfgOpen, setCfgOpen] = useState(false);

  const roomLabel =
    ed.units === "ft"
      ? `${(ed.lux.roomWidthM * 3.281).toFixed(1)} × ${(ed.lux.roomHeightM * 3.281).toFixed(1)} ft`
      : `${Math.round(ed.lux.roomWidthM * 100)} × ${Math.round(ed.lux.roomHeightM * 100)} cm`;

  return (
    <div className="tb">
      {/* ---- row 1 ---- */}
      <div className="tb-row">
        <a className="brand" href="#/">
          <svg width="20" height="20" viewBox="0 0 32 32">
            <polygon points="16,3 27,9.5 27,22.5 16,29 5,22.5 5,9.5" fill="none" stroke={COLORS.accent} strokeWidth="2.5" strokeLinejoin="round" />
            <circle cx="16" cy="16" r="3" fill={COLORS.amber} />
          </svg>
          <span>HEXLIGHT</span>
        </a>

        <select className="tb-select" value="" onChange={(e) => { if (e.target.value) ed.loadTemplate(e.target.value); e.target.value = ""; }}>
          <option value="">Load template…</option>
          {TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        <span className="tb-label">Grid orientation</span>
        <div className="seg icon">
          <button className={ed.orientation === "pointy" ? "active" : ""} onClick={() => ed.orientation !== "pointy" && ed.toggleOrientation()} title="Pointy-top">⬢</button>
          <button className={ed.orientation === "flat" ? "active" : ""} onClick={() => ed.orientation !== "flat" && ed.toggleOrientation()} title="Flat-top">⬣</button>
        </div>

        <div className="seg">
          <button className={ed.units === "cm" ? "active" : ""} onClick={() => ed.setUnits("cm")}>cm</button>
          <button className={ed.units === "ft" ? "active" : ""} onClick={() => ed.setUnits("ft")}>ft</button>
        </div>

        <div className="tb-title">Untitled layout</div>

        <div className="spacer" />

        <button className="tbtn" onClick={ed.clear}>New layout</button>
        <button className="tbtn" onClick={ed.clear}>Clear layout</button>
        <button className="tbtn primary" onClick={onExport}>Export PDF</button>
      </div>

      {/* ---- row 2 ---- */}
      <div className="tb-row">
        <div className="seg">
          <button className={ed.mode === "hex" ? "active" : ""} onClick={() => ed.setMode("hex")}>◇ Hex</button>
          <button className={ed.mode === "lines" ? "active" : ""} onClick={() => ed.setMode("lines")}>⌐ Lines</button>
          <button className={ed.mode === "move" ? "active" : ""} onClick={() => ed.setMode("move")}>✛ Move</button>
        </div>

        <span className="tb-label">Hex bars</span>
        <select className="tb-select" value={ed.hexSystem} onChange={(e) => ed.setHexSystem(e.target.value)}>
          {SYSTEMS.map((s) => <option key={s.id} value={s.id}>{s.segmentLength}mm</option>)}
        </select>

        <span className="tb-label">Line bars</span>
        <select className="tb-select" value={ed.lineSystem} onChange={(e) => ed.setLineSystem(e.target.value)}>
          {SYSTEMS.map((s) => <option key={s.id} value={s.id}>{s.segmentLength}mm</option>)}
        </select>

        <div className="cfg-wrap">
          <button className={`tbtn ${cfgOpen ? "on" : ""}`} onClick={() => setCfgOpen((v) => !v)}>⚙ Bar configuration ▾</button>
          {cfgOpen && <BarConfig ed={ed} onClose={() => setCfgOpen(false)} />}
        </div>

        <div className="spacer" />

        <button className="tbtn pill" title="Room size — set in Light check">▭ {roomLabel}</button>
      </div>
    </div>
  );
}
