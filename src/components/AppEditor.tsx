import { useEffect, useRef, useState } from "react";
import { useEditor } from "../store";
import { SYSTEMS } from "../engine/spec";
import { decodeDesign } from "../engine/share";
import Toolbar from "./Toolbar";
import Canvas from "./Canvas";
import Sidebar from "./Sidebar";
import ShareModal from "./ShareModal";
import { exportPdf } from "../engine/pdf";

export default function AppEditor() {
  const ed = useEditor();
  const edRef = useRef(ed);
  edRef.current = ed;
  const [share, setShare] = useState(false);

  // restore a shared design from the URL fragment (#/app?d=...)
  useEffect(() => {
    const m = window.location.hash.match(/[?&]d=([^&]+)/);
    if (!m) return;
    const payload = decodeDesign(m[1]);
    if (payload) edRef.current.applyShared(payload);
    // strip the param so edits don't keep re-applying / keep URL clean
    history.replaceState(null, "", `${location.pathname}#/app`);
  }, []);

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
        case "1": case "2": case "3": case "4": case "5": {
          const sys = SYSTEMS[+k - 1];
          if (sys) (ed.mode === "lines" ? ed.setLineSystem : ed.setHexSystem)(sys.id);
          break;
        }
        case "c": if (e.shiftKey) ed.clear(); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app">
      <Toolbar
        ed={ed}
        onExport={() => { void exportPdf(ed.doc, ed.lux, 1, ed.barConfig, ed.layoutName, ed.cctId); }}
        onShare={() => setShare(true)}
      />
      <div className="workspace">
        <Canvas ed={ed} />
        <Sidebar ed={ed} />
      </div>
      {share && <ShareModal ed={ed} onClose={() => setShare(false)} />}
    </div>
  );
}
