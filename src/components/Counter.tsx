interface CounterProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  ariaLabel?: string;
}

export function Counter({
  value,
  onChange,
  min = 0,
  max = 99,
  ariaLabel
}: CounterProps) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));
  return (
    <div className="counter" role="group" aria-label={ariaLabel}>
      <button
        type="button"
        className="counter__btn"
        aria-label="Decrease"
        onClick={dec}
        disabled={value <= min}
      >
        −
      </button>
      <span className="counter__value" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className="counter__btn"
        aria-label="Increase"
        onClick={inc}
        disabled={value >= max}
      >
        +
      </button>
    </div>
  );
}
