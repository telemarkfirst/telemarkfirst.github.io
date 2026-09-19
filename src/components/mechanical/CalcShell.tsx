import React from 'react';
import styles from './Calculator.module.css';

/**
 * Shared primitives for the engineering calculators.
 *
 * Every calculator is a pure client-side widget: the student types numbers and
 * immediately sees the derived result. Nothing is saved and nothing is graded.
 * The goal is to make the design math visible, not to replace it.
 */

export function CalcShell({
  title,
  subtitle,
  children,
  footnote,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footnote?: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className={styles.shell}>
      <div className={styles.header}>
        <h4 className={styles.title}>{title}</h4>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {children}
      {footnote && <p className={styles.footnote}>{footnote}</p>}
    </section>
  );
}

export function Inputs({children}: {children: React.ReactNode}): React.JSX.Element {
  return <div className={styles.inputs}>{children}</div>;
}

export function NumberField({
  label,
  value,
  onChange,
  hint,
  min,
  max,
  step = 'any',
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  hint?: string;
  min?: number;
  max?: number;
  step?: number | 'any';
}): React.JSX.Element {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <input
        className={styles.input}
        type="number"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const next = Number.parseFloat(event.target.value);
          onChange(Number.isFinite(next) ? next : 0);
        }}
      />
      {hint && <span className={styles.fieldHint}>{hint}</span>}
    </label>
  );
}

export function RangeField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  hint,
  unit,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step?: number;
  hint?: string;
  unit?: string;
}): React.JSX.Element {
  // A slider makes the relationship tangible; the number box keeps precise
  // entry available, and both drive the same value.
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>
        {label}
        <span className={styles.fieldValue}>
          {value}
          {unit ? ` ${unit}` : ''}
        </span>
      </span>
      <input
        className={styles.range}
        type="range"
        value={Number.isFinite(value) ? value : min}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const next = Number.parseFloat(event.target.value);
          onChange(Number.isFinite(next) ? next : min);
        }}
      />
      <input
        className={styles.input}
        type="number"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
        aria-label={`${label}, exact value`}
        onChange={(event) => {
          const next = Number.parseFloat(event.target.value);
          onChange(Number.isFinite(next) ? next : min);
        }}
      />
      {hint && <span className={styles.fieldHint}>{hint}</span>}
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  hint?: string;
}): React.JSX.Element {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <input
        className={styles.input}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint && <span className={styles.fieldHint}>{hint}</span>}
    </label>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: T;
  options: {value: T; label: string}[];
  onChange: (next: NoInfer<T>) => void;
  hint?: string;
}): React.JSX.Element {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <select
        className={styles.select}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && <span className={styles.fieldHint}>{hint}</span>}
    </label>
  );
}

export function Presets<T extends string>({
  label = 'Scenarios',
  options,
  active,
  onSelect,
}: {
  label?: string;
  options: {id: T; label: string; hint?: string}[];
  active: T | null;
  onSelect: (id: T) => void;
}): React.JSX.Element {
  // One click loads a configuration worth looking at, usually one that fails
  // in an instructive way. Faster than typing eight numbers to see a point.
  return (
    <div className={styles.presets}>
      <span className={styles.presetLabel}>{label}</span>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`${styles.preset} ${active === option.id ? styles.presetActive : ''}`}
          onClick={() => onSelect(option.id)}
          title={option.hint}
          aria-pressed={active === option.id}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Results({children}: {children: React.ReactNode}): React.JSX.Element {
  return <div className={styles.results}>{children}</div>;
}

export function Result({
  value,
  label,
  note,
}: {
  value: string;
  label: string;
  note?: string;
}): React.JSX.Element {
  return (
    <div className={styles.result}>
      <span className={styles.resultValue}>{value}</span>
      <span className={styles.resultLabel}>{label}</span>
      {note && <span className={styles.resultNote}>{note}</span>}
    </div>
  );
}

export function Verdict({
  level,
  children,
}: {
  level: 'good' | 'warn' | 'bad';
  children: React.ReactNode;
}): React.JSX.Element {
  const levelClass =
    level === 'good'
      ? styles.verdictGood
      : level === 'warn'
        ? styles.verdictWarn
        : styles.verdictBad;
  return <p className={`${styles.verdict} ${levelClass}`}>{children}</p>;
}

/** Formats a number to a fixed precision without trailing noise. */
export function fmt(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '--';
  return value.toFixed(digits);
}

export {styles as calcStyles};
