import React from 'react';
import styles from './Visual.module.css';

/**
 * Shared frame for the engineering visualizations.
 *
 * Each visual is a plain SVG driven by the same numbers the surrounding
 * calculator displays, so the picture and the readout can never disagree.
 * Every figure carries a text description for screen readers, since the
 * shapes themselves carry the meaning.
 */
export default function Figure({
  caption,
  description,
  viewBox,
  children,
  legend,
  note,
}: {
  caption: string;
  /** Announced to assistive technology in place of the drawing. */
  description: string;
  viewBox: string;
  children: React.ReactNode;
  legend?: {color: string; label: string}[];
  note?: React.ReactNode;
}): React.JSX.Element {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>{caption}</figcaption>
      <svg
        className={styles.svg}
        viewBox={viewBox}
        role="img"
        aria-label={description}
        preserveAspectRatio="xMidYMid meet"
      >
        {children}
      </svg>
      {legend && (
        <div className={styles.legend}>
          {legend.map((item) => (
            <span key={item.label} className={styles.legendItem}>
              <span
                className={styles.swatch}
                style={{background: item.color}}
                aria-hidden="true"
              />
              {item.label}
            </span>
          ))}
        </div>
      )}
      {note && <p className={styles.note}>{note}</p>}
    </figure>
  );
}

export {styles as visualStyles};
