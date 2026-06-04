import { Editor } from "../store";
import { COLORS } from "../engine/spec";

export default function Toolbar({ ed, onExport }: { ed: Editor; onExport: () => void }) {
  return (
    <div className="toolbar">
      <a className="brand" href="#/">
        <svg width="22" height="22" viewBox="0 0 32 32">
          <polygon points="16,3 27,9.5 27,22.5 16,29 5,22.5 5,9.5" fill="none" stroke={COLORS.accent} strokeWidth="2.5" strokeLinejoin="round" />
          <circle cx="16" cy="16" r="3" fill={COLORS.amber} />
        </svg>
        <span>Hexlight</span>
      </a>

      <div className="seg">
        <button className={ed.mode === "hex" ? "active" : ""} onClick={() => ed.setMode("hex")}>Hex</button>
        <button className={ed.mode === "lines" ? "active" : ""} onClick={() => ed.setMode("lines")}>Lines</button>
        <button className={ed.mode === "move" ? "active" : ""} onClick={() => ed.setMode("move")}>Move</button>
      </div>

      {ed.mode === "hex" && (
        <div className="seg">
          <button className={ed.hexSystem === "hex440" ? "active" : ""} onClick={() => ed.setHexSystem("hex440")}>440mm</button>
          <button className={ed.hexSystem === "hex565" ? "active" : ""} onClick={() => ed.setHexSystem("hex565")}>565mm</button>
        </div>
      )}

      <div className="spacer" />

      <button className="tbtn" disabled={!ed.canUndo} onClick={ed.undo} title="Undo">↶</button>
      <button className="tbtn" disabled={!ed.canRedo} onClick={ed.redo} title="Redo">↷</button>
      <button className="tbtn" onClick={ed.clear} title="Clear">Clear</button>
      <button className="tbtn primary" onClick={onExport}>Export PDF</button>
    </div>
  );
}
