import { useEffect, useRef, useState } from 'react';
import { formatHours, parseHours } from '../utils/time';

interface HoursInputProps {
  id?: string;
  value: number | null;
  onChange: (next: number | null) => void;
  placeholder?: string;
  step?: number;
}

/**
 * Decimal-hours input. Local string draft so partial values like "138" or
 * "1387." are not stomped by re-renders; commits the parsed number on every
 * keystroke and re-formats on blur.
 */
export function HoursInput({
  id,
  value,
  onChange,
  placeholder = '0.0',
  step = 0.1
}: HoursInputProps) {
  const [draft, setDraft] = useState<string>(
    value == null ? '' : formatHours(value)
  );
  const lastEmitted = useRef<number | null>(value);

  useEffect(() => {
    if (value !== lastEmitted.current) {
      setDraft(value == null ? '' : formatHours(value));
      lastEmitted.current = value;
    }
  }, [value]);

  return (
    <input
      id={id}
      type="number"
      inputMode="decimal"
      step={step}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        const parsed = parseHours(raw);
        if (raw === '' || parsed != null) {
          lastEmitted.current = parsed;
          onChange(parsed);
        }
      }}
      onBlur={() => {
        const parsed = parseHours(draft);
        if (parsed != null) setDraft(formatHours(parsed));
        lastEmitted.current = parsed;
        onChange(parsed);
      }}
    />
  );
}
