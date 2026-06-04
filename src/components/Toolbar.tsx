import { useState } from "react";
import { Editor } from "../store";
import { COLORS, SYSTEMS } from "../engine/spec";
import { TEMPLATES } from "../engine/templates";
import BarConfig from "./BarConfig";

const HexIcon = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <polygon points="7,1 12.5,4 12.5,10 7,13 1.5,10 1.5,4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);
const LinesIcon = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <circle cx="2" cy="12" r="1.5" fill="currentColor" />
    <circle cx="2" cy="3" r="1.5" fill="currentColor" />
    <circle cx="12" cy="3" r="1.5" fill="currentColor" />
    <line x1="2" y1="12" x2="2" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="2" y1="3" x2="12" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const MoveIcon = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <polygon points="7,0 5,3 9,3" fill="currentColor" />
    <polygon points="7,14 5,11 9,11" fill="currentColor" />
    <polygon points="0,7 3,5 3,9" fill="currentColor" />
    <polygon points="14,7 11,5 11,9" fill="currentColor" />
  </svg>
);

export default function Toolbar({ ed, onExport }: { ed: Editor; onExport: () => void }) {
  const [cfgOpen, setCfgOpen] = useState(false);

  const roomLabel =
    ed.units === "cm"
      ? `${Math.round(ed.lux.roomWidthM * 100)} × ${Math.round(ed.lux.roomHeightM * 100)} cm`
      : `${ed.lux.roomWidthM} × ${ed.lux.roomHeightM} m`;

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
          <button className={ed.units === "m" ? "active" : ""} onClick={() => ed.setUnits("m")}>m</button>
          <button className={ed.units === "cm" ? "active" : ""} onClick={() => ed.setUnits("cm")}>cm</button>
        </div>

        <input
          className="tb-name"
          value={ed.layoutName}
          onChange={(e) => ed.setLayoutName(e.target.value)}
          placeholder="Untitled layout"
          aria-label="Layout name"
        />
        <span className="tb-pencil">✎</span>

        <div className="spacer" />

        <button className="tbtn" onClick={ed.clear}>New layout</button>
        <button className="tbtn" onClick={ed.clear}>Clear layout</button>
        <button className="tbtn primary" onClick={onExport}>Export PDF</button>
      </div>

      {/* ---- row 2 ---- */}
      <div className="tb-row">
        <div className="seg">
          <button className={ed.mode === "hex" ? "active" : ""} onClick={() => ed.setMode("hex")}><HexIcon /> Hex</button>
          <button className={ed.mode === "lines" ? "active" : ""} onClick={() => ed.setMode("lines")}><LinesIcon /> Lines</button>
          <button className={ed.mode === "move" ? "active" : ""} onClick={() => ed.setMode("move")}><MoveIcon /> Move</button>
        </div>

        {ed.mode === "lines" ? (
          <>
            <span className="tb-label">Line bars</span>
            <select className="tb-select" value={ed.lineSystem} onChange={(e) => ed.setLineSystem(e.target.value)}>
              {SYSTEMS.filter((s) => s.id.startsWith("line")).map((s) => <option key={s.id} value={s.id}>{s.segmentLength}mm</option>)}
            </select>
          </>
        ) : (
          <>
            <span className="tb-label">Hex bars</span>
            <select className="tb-select" value={ed.hexSystem} onChange={(e) => ed.setHexSystem(e.target.value)}>
              {SYSTEMS.filter((s) => s.id.startsWith("hex")).map((s) => <option key={s.id} value={s.id}>{s.segmentLength}mm</option>)}
            </select>
          </>
        )}

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
