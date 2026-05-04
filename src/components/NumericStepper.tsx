import "./NumericStepper.css";

interface NumericStepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

export function NumericStepper({ label, value, onChange, min, max, step = 1, unit }: NumericStepperProps) {
  const dec = () => onChange(clamp(value - step, min, max));
  const inc = () => onChange(clamp(value + step, min, max));

  return (
    <div className="stepper">
      <div className="stepper__label">{label}</div>
      <div className="stepper__controls">
        <button
          type="button"
          className="stepper__btn"
          onClick={dec}
          disabled={min !== undefined && value <= min}
          aria-label={`Decrease ${label}`}
        >−</button>
        <div className="stepper__value">
          <span className="stepper__num mono">{value}</span>
          {unit ? <span className="stepper__unit">{unit}</span> : null}
        </div>
        <button
          type="button"
          className="stepper__btn"
          onClick={inc}
          disabled={max !== undefined && value >= max}
          aria-label={`Increase ${label}`}
        >+</button>
      </div>
    </div>
  );
}

function clamp(value: number, min?: number, max?: number): number {
  if (min !== undefined && value < min) return min;
  if (max !== undefined && value > max) return max;
  return value;
}
