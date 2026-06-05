import { Editor } from "../store";
import { CONNECTOR_LABELS, USE_CASES } from "../engine/spec";
import { TEMPLATES } from "../engine/templates";
import { MountingMode } from "../engine/lux";
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

        <div className={`lux-readout ${lx.zone ?? ""}`}>
          {lx.errorMessage ? (
            <p className="err">{lx.errorMessage}</p>
          ) : lx.luxEstimate == null ? (
            <p className="hint">Place hexes to estimate.</p>
          ) : (
            <>
              <div className="lux-big">
                {lx.luxEstimate}<span className="lux-unit">lx</span>
              </div>
              <div className="lux-meta">
                target {lx.targetLux} lx · {lx.rangeLow}–{lx.rangeHigh} lx ·{" "}
                <b className={lx.zone ?? ""}>{lx.zone === "on" ? "on target" : lx.zone}</b>
              </div>
              {lx.autoDrop != null && (
                <div className="lux-meta">auto drop {lx.autoDrop.toFixed(2)} m</div>
              )}
              <div className="lux-meta dim">±20% estimate (lumen method, MF 0.80)</div>
            </>
          )}
        </div>
      </Section>

      <footer className="sidebar-footer">© 2026 Hexlight · client-side estimate</footer>
    </aside>
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
