import React from 'react';
import styles from './PlayControl.module.css';

/**
 * Play and reset controls for an animated figure.
 *
 * Rendered disabled with an explanation when the visitor prefers reduced
 * motion, rather than hidden, so the control does not silently vanish.
 */
export default function PlayControl({
  playing,
  disabled,
  onToggle,
  onReset,
  label,
}: {
  playing: boolean;
  disabled: boolean;
  onToggle: () => void;
  onReset?: () => void;
  label: string;
}): React.JSX.Element {
  return (
    <div className={styles.row}>
      <button
        type="button"
        className={styles.control}
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={playing}
      >
        <span className={styles.glyph} aria-hidden="true">{playing ? '❚❚' : '▶'}</span>
        {playing ? 'Pause' : label}
      </button>
      {onReset && (
        <button type="button" className={styles.control} onClick={onReset} disabled={disabled}>
          <span className={styles.glyph} aria-hidden="true">↺</span>
          Reset
        </button>
      )}
      {disabled && (
        <span className={styles.hint}>
          Animation is off because your system asks for reduced motion. Every
          value is still adjustable by hand.
        </span>
      )}
    </div>
  );
}
