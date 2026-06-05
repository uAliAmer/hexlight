import { InputHTMLAttributes, useEffect, useState } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: number;
  onChange: (n: number) => void;
};

// Number input that lets you clear the field while typing. The empty/partial
// text (e.g. "" or "5.") is kept locally; the parent only receives valid numbers.
export default function NumField({ value, onChange, ...rest }: Props) {
  const [text, setText] = useState(String(value));

  // sync when the external value changes to something the text doesn't represent
  useEffect(() => {
    if (parseFloat(text) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      {...rest}
      type="number"
      value={text}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        const n = parseFloat(t);
        if (!Number.isNaN(n)) onChange(n);
      }}
      onBlur={() => {
        // normalise on blur: empty/invalid falls back to current value
        if (Number.isNaN(parseFloat(text))) setText(String(value));
      }}
    />
  );
}
