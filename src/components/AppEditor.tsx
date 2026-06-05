import { useEffect, useRef } from "react";
import { useEditor } from "../store";
import Toolbar from "./Toolbar";
import Canvas from "./Canvas";
import Sidebar from "./Sidebar";
import { exportPdf } from "../engine/pdf";

export default function AppEditor() {
  const ed = useEditor();
  const edRef = useRef(ed);
  edRef.current = ed;

  // global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ed = edRef.current;
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();

      if (mod && k === "z") { e.preventDefault(); e.shiftKey ? ed.redo() : ed.undo(); return; }
      if (mod && k === "y") { e.preventDefault(); ed.redo(); return; }
      if (mod) return;

      switch (k) {
        case "h": ed.setMode("hex"); break;
        case "l": ed.setMode("lines"); break;
        case "m": case "v": ed.setMode("move"); break;
        case "o": ed.toggleOrientation(); break;
        case "f": window.dispatchEvent(new Event("hl-fit")); break;
        case "1": ed.mode === "lines" ? ed.setLineSystem("line1176") : ed.setHexSystem("hex440"); break;
        case "2": if (ed.mode !== "lines") ed.setHexSystem("hex565"); break;
        case "c": if (e.shiftKey) ed.clear(); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app">
      <Toolbar ed={ed} onExport={() => { void exportPdf(ed.doc, ed.lux, 1, ed.barConfig, ed.layoutName, ed.cctId); }} />
      <div className="workspace">
        <Canvas ed={ed} />
        <Sidebar ed={ed} />
      </div>
    </div>
  );
}
