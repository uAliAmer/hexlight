import { InputHTMLAttributes, useEffect, useState } from "react";
import { Editor } from "../store";
import { SYSTEMS, CURRENCY, defaultPriceConfig } from "../engine/spec";

const PH = "افتراضي"; // neutral placeholder — never reveals the built-in price

// Override-only price input: blank by default, neutral placeholder (never the
// built-in price), clearing the field reverts to the built-in price.
function OverrideField({ value, onSet, ...rest }:
  Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "placeholder"> & {
    value?: number; onSet: (v?: number) => void;
  }) {
  const [t, setT] = useState(value == null ? "" : String(value));
  useEffect(() => { setT(value == null ? "" : String(value)); }, [value]);
  return (
    <input
      {...rest}
      type="number"
      min={0}
      step={250}
      value={t}
      placeholder={PH}
      onChange={(e) => {
        const x = e.target.value;
        setT(x);
        const n = parseFloat(x);
        onSet(x === "" || Number.isNaN(n) ? undefined : n);
      }}
    />
  );
}

// Editable material price overrides (IQD). Originals are not shown.
export default function PriceConfig({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const c = ed.priceConfig;
  const setBar = (kind: "white" | "rgbic", id: string, v?: number) => {
    const m = { ...c.bar[kind] };
    if (v == null) delete m[id]; else m[id] = v;
    ed.setPriceConfig({ ...c, bar: { ...c.bar, [kind]: m } });
  };
  const setField = (key: "connector" | "power" | "hanger", v?: number) => {
    const next = { ...c };
    if (v == null) delete next[key]; else next[key] = v;
    ed.setPriceConfig(next);
  };

  return (
    <>
      <div className="cfg-backdrop" onClick={onClose} />
      <div className="cfg-pop" onClick={(e) => e.stopPropagation()}>
        <div className="cfg-note">اترك الحقل فارغاً لاستخدام السعر الافتراضي. القيمة تتجاوز السعر الأصلي.</div>

        <div className="cfg-head">أسعار الأضلاع — أبيض ({CURRENCY})</div>
        {SYSTEMS.map((s) => (
          <div className="cfg-row" key={`w${s.id}`}>
            <span>{s.label}</span>
            <div className="cfg-num">
              <OverrideField value={c.bar.white[s.id]} onSet={(v) => setBar("white", s.id, v)} />
              <i>{CURRENCY}</i>
            </div>
          </div>
        ))}

        <div className="cfg-head">أسعار الأضلاع — RGBIC ({CURRENCY})</div>
        {SYSTEMS.map((s) => (
          <div className="cfg-row" key={`r${s.id}`}>
            <span>{s.label}</span>
            <div className="cfg-num">
              <OverrideField value={c.bar.rgbic[s.id]} onSet={(v) => setBar("rgbic", s.id, v)} />
              <i>{CURRENCY}</i>
            </div>
          </div>
        ))}

        <div className="cfg-head">قطع أخرى ({CURRENCY})</div>
        <div className="cfg-row">
          <span>الموصل (للقطعة)</span>
          <div className="cfg-num">
            <OverrideField value={c.connector} onSet={(v) => setField("connector", v)} />
            <i>{CURRENCY}</i>
          </div>
        </div>
        <div className="cfg-row">
          <span>مدخل الطاقة</span>
          <div className="cfg-num">
            <OverrideField value={c.power} onSet={(v) => setField("power", v)} />
            <i>{CURRENCY}</i>
          </div>
        </div>
        <div className="cfg-row">
          <span>سلك التعليق</span>
          <div className="cfg-num">
            <OverrideField value={c.hanger} onSet={(v) => setField("hanger", v)} />
            <i>{CURRENCY}</i>
          </div>
        </div>

        <button className="cfg-reset" onClick={() => ed.setPriceConfig(defaultPriceConfig())}>مسح كل التجاوزات</button>
      </div>
    </>
  );
}
