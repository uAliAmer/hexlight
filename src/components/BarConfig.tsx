import { Editor } from "../store";
import { BAR_LENGTHS, BarLength, defaultBarConfig } from "../engine/spec";

export default function BarConfig({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const c = ed.barConfig;
  const set = (patch: Partial<typeof c>) => ed.setBarConfig({ ...c, ...patch });
  const setWatts = (len: BarLength, w: number) =>
    set({ wattsPerBar: { ...c.wattsPerBar, [len]: w } });

  return (
    <>
      <div className="cfg-backdrop" onClick={onClose} />
      <div className="cfg-pop" onClick={(e) => e.stopPropagation()}>
        <div className="cfg-head">Global</div>

        <div className="cfg-row">
          <span>Efficacy</span>
          <div className="cfg-num">
            <input type="number" min={1} step={1} value={c.lmPerW}
              onChange={(e) => set({ lmPerW: +e.target.value })} />
            <i>lm/W</i>
          </div>
        </div>

        <div className="cfg-row">
          <span>Driver eff.</span>
          <div className="cfg-num">
            <input type="number" min={1} max={100} step={1} value={Math.round(c.driverEff * 100)}
              onChange={(e) => set({ driverEff: +e.target.value / 100 })} />
            <i>%</i>
          </div>
        </div>

        <div className="cfg-head">Watts per bar</div>
        {BAR_LENGTHS.map((len) => (
          <div className="cfg-row" key={len}>
            <span>{len} mm</span>
            <div className="cfg-num">
              <input type="number" min={0} step={0.5} value={c.wattsPerBar[len]}
                onChange={(e) => setWatts(len, +e.target.value)} />
              <i>W</i>
            </div>
            <span className="cfg-lm">→ {Math.round(c.wattsPerBar[len] * c.lmPerW)} lm</span>
          </div>
        ))}

        <button className="cfg-reset" onClick={() => ed.setBarConfig(defaultBarConfig())}>Reset defaults</button>
      </div>
    </>
  );
}
