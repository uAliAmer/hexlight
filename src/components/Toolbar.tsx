import { useState } from "react";
import { Editor } from "../store";
import { CCT_BY_ID, CCT_OPTIONS, COLORS, SYSTEMS } from "../engine/spec";
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
      ? `${Math.round(ed.lux.roomWidthM * 100)} × ${Math.round(ed.lux.roomHeightM * 100)} سم`
      : `${ed.lux.roomWidthM} × ${ed.lux.roomHeightM} م`;

  return (
    <div className="tb">
      {/* ---- row 1 ---- */}
      <div className="tb-row">
        <a className="brand" href="#/">
          <svg width="20" height="20" viewBox="0 0 32 32">
            <polygon points="16,3 27,9.5 27,22.5 16,29 5,22.5 5,9.5" fill="none" stroke={COLORS.accent} strokeWidth="2.5" strokeLinejoin="round" />
            <circle cx="16" cy="16" r="3" fill={COLORS.amber} />
          </svg>
          <span>هكسلايت</span>
        </a>

        <select className="tb-select" value="" onChange={(e) => { if (e.target.value) ed.loadTemplate(e.target.value); e.target.value = ""; }}>
          <option value="">تحميل قالب…</option>
          {TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        <span className="tb-label">اتجاه الشبكة</span>
        <div className="seg icon">
          <button className={ed.orientation === "pointy" ? "active" : ""} onClick={() => ed.orientation !== "pointy" && ed.toggleOrientation()} title="رأس مدبّب">⬢</button>
          <button className={ed.orientation === "flat" ? "active" : ""} onClick={() => ed.orientation !== "flat" && ed.toggleOrientation()} title="رأس مسطّح">⬣</button>
        </div>

        <div className="seg">
          <button className={ed.units === "m" ? "active" : ""} onClick={() => ed.setUnits("m")}>م</button>
          <button className={ed.units === "cm" ? "active" : ""} onClick={() => ed.setUnits("cm")}>سم</button>
        </div>

        <div className="cct-pick">
          <span className={`cct-swatch ${CCT_BY_ID[ed.cctId]?.rgbic ? "rgbic" : ""}`}
            style={{ background: CCT_BY_ID[ed.cctId]?.rgbic ? undefined : CCT_BY_ID[ed.cctId]?.color }} />
          <select className="tb-select" value={ed.cctId} onChange={(e) => ed.setCctId(e.target.value)} title="لون الإضاءة">
            {CCT_OPTIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>

        <input
          className="tb-name"
          value={ed.layoutName}
          onChange={(e) => ed.setLayoutName(e.target.value)}
          placeholder="تصميم بدون اسم"
          aria-label="اسم التصميم"
        />
        <span className="tb-pencil">✎</span>

        <div className="spacer" />

        <div className="seg">
          <button disabled={!ed.canUndo} onClick={ed.undo} title="تراجع (Ctrl+Z)">↶</button>
          <button disabled={!ed.canRedo} onClick={ed.redo} title="إعادة (Ctrl+Shift+Z)">↷</button>
        </div>
        <button className="tbtn" onClick={ed.clear}>تصميم جديد</button>
        <button className="tbtn" onClick={ed.clear}>مسح التصميم</button>
        <button className="tbtn primary" onClick={onExport}>تصدير PDF</button>
      </div>

      {/* ---- row 2 ---- */}
      <div className="tb-row">
        <div className="seg">
          <button className={ed.mode === "hex" ? "active" : ""} onClick={() => ed.setMode("hex")}><HexIcon /> سداسي</button>
          <button className={ed.mode === "lines" ? "active" : ""} onClick={() => ed.setMode("lines")}><LinesIcon /> خطوط</button>
          <button className={ed.mode === "move" ? "active" : ""} onClick={() => ed.setMode("move")}><MoveIcon /> تحريك</button>
        </div>

        {ed.mode === "lines" ? (
          <>
            <span className="tb-label">أضلاع خطية</span>
            <select className="tb-select" value={ed.lineSystem} onChange={(e) => ed.setLineSystem(e.target.value)}>
              {SYSTEMS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </>
        ) : (
          <>
            <span className="tb-label">أضلاع سداسية</span>
            <select className="tb-select" value={ed.hexSystem} onChange={(e) => ed.setHexSystem(e.target.value)}>
              {SYSTEMS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </>
        )}

        <div className="cfg-wrap">
          <button className={`tbtn ${cfgOpen ? "on" : ""}`} onClick={() => setCfgOpen((v) => !v)}>⚙ إعدادات أضلع ▾</button>
          {cfgOpen && <BarConfig ed={ed} onClose={() => setCfgOpen(false)} />}
        </div>

        <div className="spacer" />

        <button className="tbtn pill" title="حجم الغرفة — يُضبط في فحص الإضاءة">▭ {roomLabel}</button>
      </div>
    </div>
  );
}
