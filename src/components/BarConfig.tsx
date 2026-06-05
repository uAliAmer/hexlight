import { Editor } from "../store";
import { BAR_LENGTHS, BarLength, defaultBarConfig } from "../engine/spec";
import NumField from "./NumField";

export default function BarConfig({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const c = ed.barConfig;
  const set = (patch: Partial<typeof c>) => ed.setBarConfig({ ...c, ...patch });
  const setWatts = (len: BarLength, w: number) =>
    set({ wattsPerBar: { ...c.wattsPerBar, [len]: w } });

  return (
    <>
      <div className="cfg-backdrop" onClick={onClose} />
      <div className="cfg-pop" onClick={(e) => e.stopPropagation()}>
        <div className="cfg-head">عام</div>

        <div className="cfg-row">
          <span>الفعالية الضوئية</span>
          <div className="cfg-num">
            <NumField min={1} step={1} value={c.lmPerW} onChange={(v) => set({ lmPerW: v })} />
            <i>لومن/واط</i>
          </div>
        </div>

        <div className="cfg-row">
          <span>كفاءة المحوّل</span>
          <div className="cfg-num">
            <NumField min={1} max={100} step={1} value={Math.round(c.driverEff * 100)}
              onChange={(v) => set({ driverEff: v / 100 })} />
            <i>%</i>
          </div>
        </div>

        <div className="cfg-head">واط لكل ضلع</div>
        {BAR_LENGTHS.map((len) => (
          <div className="cfg-row" key={len}>
            <span>{len} مم</span>
            <div className="cfg-num">
              <NumField min={0} step={0.5} value={c.wattsPerBar[len]} onChange={(v) => setWatts(len, v)} />
              <i>واط</i>
            </div>
            <span className="cfg-lm">→ {Math.round(c.wattsPerBar[len] * c.lmPerW)} لومن</span>
          </div>
        ))}

        <button className="cfg-reset" onClick={() => ed.setBarConfig(defaultBarConfig())}>إعادة الافتراضي</button>
      </div>
    </>
  );
}
