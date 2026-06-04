import { useEditor } from "../store";
import Toolbar from "./Toolbar";
import Canvas from "./Canvas";
import Sidebar from "./Sidebar";
import { exportPdf } from "../engine/pdf";

export default function AppEditor() {
  const ed = useEditor();
  return (
    <div className="app">
      <Toolbar ed={ed} onExport={() => exportPdf(ed.doc, ed.lux, 1, ed.barConfig, ed.layoutName)} />
      <div className="workspace">
        <Canvas ed={ed} />
        <Sidebar ed={ed} />
      </div>
    </div>
  );
}
