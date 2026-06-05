import { Editor } from "../store";
import { BAR_LENGTHS, BarLength, CONNECTOR_LABELS, USE_CASES } from "../engine/spec";
import { TEMPLATES } from "../engine/templates";
import { LuxResult, MountingMode } from "../engine/lux";
import NumField from "./NumField";

export default function Sidebar({ ed }: { ed: Editor }) {
  const { bom, luxResult: lx, lux } = ed;

  return (
    <aside className="sidebar">
      {/* Templates */}
      <Section title="Templates">
        <div className="template-grid">
          {TEMPLATES.map((t) => (
            <button key={t.id} className="template-card" onClick={() => ed.loadTemplate(t.id)}>
              <span className="tc-count">{t.hexCount}</span>
              <span className="tc-name">{t.name}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* BOM */}
      <Section title="Bill of materials">
        <div className="bom-block">
          <div className="bom-sub">Bars</div>
          {bom.segmentGroups.length === 0 && <p className="hint">Place hexes to build a list.</p>}
          {bom.segmentGroups.map((s) => (
            <Row key={s.systemId} label={`${s.label} bar`} value={s.count} />
          ))}
        </div>

        <div className="bom-block">
          <div className="bom-sub">Connectors</div>
          {bom.connectorCounts.length === 0 && <p className="hint">—</p>}
          {bom.connectorCounts.map((c) => (
            <Row key={c.type} label={CONNECTOR_LABELS[c.type]} value={c.count} />
          ))}
        </div>

        <div className="bom-block">
          <div className="bom-sub">Power</div>
          <Row label="Total load" value={`${bom.power.totalWatts} W`} />
          <Row label="Runs" value={bom.power.runs} />
          <Row label="Power inputs" value={bom.power.powerInputs} accent />
        </div>

        <div className="bom-total">
          <span>Est. price</span>
          <span>${bom.estimatedPrice}</span>
        </div>
      </Section>

      {/* Light Check */}
      <Section title="Light check" beta className="top">
        <Field label="Space">
          <select value={lux.useCaseId} onChange={(e) => ed.setLux({ ...lux, useCaseId: e.target.value })}>
            {USE_CASES.map((u) => (
              <option key={u.id} value={u.id}>{u.label}</option>
            ))}
          </select>
        </Field>

        <div className="rsd-row">
          <Field label="Room W (m)">
            <NumField min={0.5} step={0.1} value={lux.roomWidthM}
              onChange={(v) => ed.setLux({ ...lux, roomWidthM: v })} />
          </Field>
          <Field label="Room D (m)">
            <NumField min={0.5} step={0.1} value={lux.roomHeightM}
              onChange={(v) => ed.setLux({ ...lux, roomHeightM: v })} />
          </Field>
        </div>

        <div className="rsd-row">
          <Field label="Ceiling (m)">
            <NumField min={1.8} step={0.05} value={lux.ceilingHeightM}
              onChange={(v) => ed.setLux({ ...lux, ceilingHeightM: v })} />
          </Field>
          <Field label="Mounting">
            <div className="seg small">
              {(["flush", "suspended", "auto"] as MountingMode[]).map((m) => (
                <button key={m} className={lux.mountingMode === m ? "active" : ""}
                  onClick={() => ed.setLux({ ...lux, mountingMode: m })}>
                  {m === "flush" ? "Flush" : m === "suspended" ? "Susp." : "Auto"}
                </button>
              ))}
            </div>
          </Field>
        </div>

        {lux.mountingMode === "suspended" && (
          <Field label="Drop from ceiling (m)">
            <NumField min={0.1} max={2} step={0.05} value={lux.dropM}
              onChange={(v) => ed.setLux({ ...lux, dropM: v })} />
          </Field>
        )}

        <LuxReadout lx={lx} ed={ed} />
      </Section>

      <footer className="sidebar-footer">© 2026 Hexlight · client-side estimate</footer>
    </aside>
  );
}

function LuxReadout({ lx, ed }: { lx: LuxResult; ed: Editor }) {
  if (lx.errorMessage) return <p className="err">{lx.errorMessage}</p>;
  if (lx.luxEstimate == null) return <p className="hint">Place hexes to estimate.</p>;

  const t = lx.targetLux;
  const maxv = t * 2; // gauge spans 0..2× target
  const pct = Math.max(2, Math.min(98, (lx.luxEstimate / maxv) * 100));
  const zoneL = (lx.rangeLow / maxv) * 100;
  const zoneW = ((lx.rangeHigh - lx.rangeLow) / maxv) * 100;
  const label = lx.useCaseLabel;
  const range = `${lx.rangeLow}–${lx.rangeHigh} lx range`;
  const msg =
    lx.zone === "on" ? `On target for ${label} (${range}).`
    : lx.zone === "under" ? `Below target for ${label} — aim for ${range}.`
    : `Above target for ${label} (${range}) — brighter than needed.`;

  const c = ed.barConfig;
  const setWatts = (len: BarLength, v: number) => ed.setBarConfig({ ...c, wattsPerBar: { ...c.wattsPerBar, [len]: v } });

  return (
    <div className={`lc ${lx.zone ?? ""}`}>
      <div className="lc-big"><span className="lc-tilde">~</span>{lx.luxEstimate}<span className="lc-unit">lx</span></div>

      <div className="lc-gauge">
        <div className="lc-zone" style={{ left: `${zoneL}%`, width: `${zoneW}%` }} />
        <div className="lc-fill" style={{ width: `${pct}%` }} />
        <div className="lc-marker" style={{ left: `${pct}%` }} />
        <div className="lc-arrow" style={{ left: `${pct}%` }} />
      </div>

      <p className="lc-msg">{msg}</p>
      {lx.autoDrop != null && <p className="lc-drop">Auto drop {lx.autoDrop.toFixed(2)} m</p>}

      <details className="lc-adv">
        <summary>Advanced — bar specs</summary>
        <div className="lc-adv-body">
          <div className="cfg-row">
            <span>Efficacy</span>
            <div className="cfg-num"><NumField min={1} step={1} value={c.lmPerW} onChange={(v) => ed.setBarConfig({ ...c, lmPerW: v })} /><i>lm/W</i></div>
          </div>
          <div className="cfg-row">
            <span>Driver eff.</span>
            <div className="cfg-num"><NumField min={1} max={100} step={1} value={Math.round(c.driverEff * 100)} onChange={(v) => ed.setBarConfig({ ...c, driverEff: v / 100 })} /><i>%</i></div>
          </div>
          {BAR_LENGTHS.map((len) => (
            <div className="cfg-row" key={len}>
              <span>{len} mm</span>
              <div className="cfg-num"><NumField min={0} step={0.5} value={c.wattsPerBar[len]} onChange={(v) => setWatts(len, v)} /><i>W</i></div>
              <span className="cfg-lm">→ {Math.round(c.wattsPerBar[len] * c.lmPerW)} lm</span>
            </div>
          ))}
        </div>
      </details>

      <p className="lc-note">
        Estimate ±20%. Based on the lumen method with typical room reflectances and 0.80 maintenance factor.
        Not a substitute for a photometric simulation.
      </p>
    </div>
  );
}

function Section({ title, children, beta, className }: { title: string; children: React.ReactNode; beta?: boolean; className?: string }) {
  return (
    <section className={`panel ${className ?? ""}`}>
      <h3 className="panel-title">
        {title}
        {beta && <span className="beta">beta</span>}
      </h3>
      {children}
    </section>
  );
}

function Row({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`row ${accent ? "accent" : ""}`}>
      <span>{label}</span>
      <span className="val">{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
