import { Editor } from "../store";
import { BAR_LENGTHS, BarLength, CONNECTOR_LABELS, USE_CASES } from "../engine/spec";
import { LuxResult, MountingMode } from "../engine/lux";
import NumField from "./NumField";

export default function Sidebar({ ed }: { ed: Editor }) {
  const { bom, luxResult: lx, lux } = ed;

  return (
    <aside className="sidebar">
      {/* BOM */}
      <Section title="قائمة المواد">
        <div className="bom-block">
          <div className="bom-sub">أضلع</div>
          {bom.segmentGroups.length === 0 && <p className="hint">ضع الأشكال السداسية لإنشاء القائمة.</p>}
          {bom.segmentGroups.map((s) => (
            <Row key={s.systemId} label={`ضلع ${s.label}`} value={s.count} />
          ))}
        </div>

        <div className="bom-block">
          <div className="bom-sub">الموصلات</div>
          {bom.connectorCounts.length === 0 && <p className="hint">—</p>}
          {bom.connectorCounts.map((c) => (
            <Row key={c.type} label={CONNECTOR_LABELS[c.type]} value={c.count} />
          ))}
        </div>

        <div className="bom-block">
          <div className="bom-sub">الطاقة</div>
          <Row label="إجمالي الحمل" value={`${bom.power.totalWatts} واط`} />
          <Row label="مداخل الطاقة" value={bom.power.powerInputs} accent />
          {lux.mountingMode === "suspended" && (
            <Row label="أسلاك التعليق" value={bom.suspensionPoints} />
          )}
        </div>

        <div className="bom-total">
          <span>السعر التقديري</span>
          <span>{bom.estimatedPrice.toLocaleString("en-US")} د.ع</span>
        </div>
      </Section>

      {/* Light Check */}
      <Section title="فحص الإضاءة" beta className="top">
        <Field label="المساحة">
          <select value={lux.useCaseId} onChange={(e) => ed.setLux({ ...lux, useCaseId: e.target.value })}>
            {USE_CASES.map((u) => (
              <option key={u.id} value={u.id}>{u.label}</option>
            ))}
          </select>
        </Field>

        <div className="rsd-row">
          <Field label="عرض الغرفة (م)">
            <NumField min={0.5} step={0.1} value={lux.roomWidthM}
              onChange={(v) => ed.setLux({ ...lux, roomWidthM: v })} />
          </Field>
          <Field label="عمق الغرفة (م)">
            <NumField min={0.5} step={0.1} value={lux.roomHeightM}
              onChange={(v) => ed.setLux({ ...lux, roomHeightM: v })} />
          </Field>
        </div>

        <div className="rsd-row">
          <Field label="الارتفاع (م)">
            <NumField min={1.8} step={0.05} value={lux.ceilingHeightM}
              onChange={(v) => ed.setLux({ ...lux, ceilingHeightM: v })} />
          </Field>
          <Field label="التركيب">
            <div className="seg small">
              {(["flush", "suspended", "auto"] as MountingMode[]).map((m) => (
                <button key={m} className={lux.mountingMode === m ? "active" : ""}
                  onClick={() => ed.setLux({ ...lux, mountingMode: m })}>
                  {m === "flush" ? "سطحي" : m === "suspended" ? "معلّق" : "تلقائي"}
                </button>
              ))}
            </div>
          </Field>
        </div>

        {lux.mountingMode === "suspended" && (
          <Field label="المسافة من السقف (م)">
            <NumField min={0.1} max={2} step={0.05} value={lux.dropM}
              onChange={(v) => ed.setLux({ ...lux, dropM: v })} />
          </Field>
        )}

        <LuxReadout lx={lx} ed={ed} />
      </Section>

      <footer className="sidebar-footer">© 2026 هكسلايت · تقدير داخل المتصفح</footer>
    </aside>
  );
}

function LuxReadout({ lx, ed }: { lx: LuxResult; ed: Editor }) {
  if (lx.errorMessage) return <p className="err">{lx.errorMessage}</p>;
  if (lx.luxEstimate == null) return <p className="hint">ضع الأشكال السداسية للتقدير.</p>;

  const t = lx.targetLux;
  const maxv = t * 2; // gauge spans 0..2× target
  const pct = Math.max(2, Math.min(98, (lx.luxEstimate / maxv) * 100));
  const zoneL = (lx.rangeLow / maxv) * 100;
  const zoneW = ((lx.rangeHigh - lx.rangeLow) / maxv) * 100;
  const label = lx.useCaseLabel;
  const range = `نطاق ${lx.rangeLow}–${lx.rangeHigh} لكس`;
  const msg =
    lx.zone === "on" ? `ضمن الهدف لـ ${label} (${range}).`
    : lx.zone === "under" ? `أقل من الهدف لـ ${label} — استهدف ${range}.`
    : `أعلى من الهدف لـ ${label} (${range}) — أكثر سطوعاً من اللازم.`;

  const c = ed.barConfig;
  const setWatts = (len: BarLength, v: number) => ed.setBarConfig({ ...c, wattsPerBar: { ...c.wattsPerBar, [len]: v } });

  return (
    <div className={`lc ${lx.zone ?? ""}`}>
      <div className="lc-big"><span className="lc-tilde">~</span>{lx.luxEstimate}<span className="lc-unit">لكس</span></div>

      <div className="lc-gauge">
        <div className="lc-zone" style={{ left: `${zoneL}%`, width: `${zoneW}%` }} />
        <div className="lc-fill" style={{ width: `${pct}%` }} />
        <div className="lc-marker" style={{ left: `${pct}%` }} />
        <div className="lc-arrow" style={{ left: `${pct}%` }} />
      </div>

      <p className="lc-msg">{msg}</p>
      {lx.autoDrop != null && <p className="lc-drop">مسافة تلقائية {lx.autoDrop.toFixed(2)} م</p>}

      <details className="lc-adv">
        <summary>متقدّم — مواصفات أضلع</summary>
        <div className="lc-adv-body">
          <div className="cfg-row">
            <span>الفعالية الضوئية</span>
            <div className="cfg-num"><NumField min={1} step={1} value={c.lmPerW} onChange={(v) => ed.setBarConfig({ ...c, lmPerW: v })} /><i>لومن/واط</i></div>
          </div>
          <div className="cfg-row">
            <span>كفاءة المحوّل</span>
            <div className="cfg-num"><NumField min={1} max={100} step={1} value={Math.round(c.driverEff * 100)} onChange={(v) => ed.setBarConfig({ ...c, driverEff: v / 100 })} /><i>%</i></div>
          </div>
          {BAR_LENGTHS.map((len) => (
            <div className="cfg-row" key={len}>
              <span>{len} مم</span>
              <div className="cfg-num"><NumField min={0} step={0.5} value={c.wattsPerBar[len]} onChange={(v) => setWatts(len, v)} /><i>واط</i></div>
              <span className="cfg-lm">→ {Math.round(c.wattsPerBar[len] * c.lmPerW)} لومن</span>
            </div>
          ))}
        </div>
      </details>

      <p className="lc-note">
        تقدير ±20٪. يعتمد على طريقة اللومن مع انعكاسات غرفة نموذجية وعامل صيانة 0.80.
        ليس بديلاً عن محاكاة ضوئية دقيقة.
      </p>
    </div>
  );
}

function Section({ title, children, beta, className }: { title: string; children: React.ReactNode; beta?: boolean; className?: string }) {
  return (
    <section className={`panel ${className ?? ""}`}>
      <h3 className="panel-title">
        {title}
        {beta && <span className="beta">تجريبي</span>}
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
