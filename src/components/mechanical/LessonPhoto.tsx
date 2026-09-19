import React from 'react';
import styles from './LessonPhoto.module.css';

export interface LessonPhotoProps {
  /**
   * Path under static/, for example 'img/mechanical/stripped-thread.jpg'.
   * When omitted, the component renders the shot request instead, so the
   * lesson stays useful and the gap stays visible.
   */
  src?: string;
  /** Required. Describes the photograph for anyone who cannot see it. */
  alt: string;
  /** Shown under the image. Says what the reader should notice. */
  caption: string;
  /** What to photograph, precise enough that someone can go and shoot it. */
  shot: string;
  /**
   * A drawing to show until a photograph exists. Not a substitute for one: a
   * real stripped thread is recognisable on sight in a way no drawing is. It
   * is here so the lesson has the picture it needs now, while the shot request
   * stays open underneath it.
   */
  drawing?: React.ReactNode;
  /** Framing guidance: distance, lighting, what must be in frame. */
  framing?: string;
  credit?: string;
}

/**
 * A photograph in a lesson, or a request for one.
 *
 * Real photographs of real failures teach faster than any drawing: a stripped
 * thread or a bound slide is instantly recognisable once seen. Rather than
 * fabricating images, this component renders a labelled request describing
 * exactly what to shoot, and swaps to the photograph once a team supplies one.
 */
export default function LessonPhoto({
  src,
  alt,
  caption,
  shot,
  drawing,
  framing,
  credit,
}: LessonPhotoProps): React.JSX.Element {
  return (
    <figure className={styles.figure}>
      {src ? (
        <img
          className={styles.image}
          src={useBaseUrlSafe(src)}
          alt={alt}
          loading="lazy"
        />
      ) : drawing ? (
        <>
          {drawing}
          <details className={styles.shotRequest}>
            <summary>A photograph would show this better</summary>
            <span className={styles.shot}>{shot}</span>
            {framing && <span className={styles.shotMeta}>Framing: {framing}</span>}
          </details>
        </>
      ) : (
        <div className={styles.placeholder} role="note" aria-label={`Photograph needed: ${shot}`}>
          <span className={styles.placeholderLabel}>Photograph needed</span>
          <span className={styles.shot}>{shot}</span>
          {framing && <span className={styles.shotMeta}>Framing: {framing}</span>}
          <span className={styles.shotMeta}>
            Add the file to static/ and pass its path as the src prop.
          </span>
        </div>
      )}
      <figcaption className={styles.caption}>
        {caption}
        {credit && <span className={styles.credit}>Photo: {credit}</span>}
      </figcaption>
    </figure>
  );
}

/**
 * Prefixes the site base URL without pulling in a hook, so the component can be
 * rendered in the Node test harness.
 *
 * The base is read from the document rather than written in: a literal
 * "/telemark/" is correct on the deployed site and wrong everywhere else,
 * which is the same bug that once sent every search result to a 404.
 */
function useBaseUrlSafe(src: string): string {
  if (/^https?:\/\//.test(src)) return src;
  const base =
    typeof document !== 'undefined'
      ? document.querySelector('base')?.getAttribute('href')
        ?? (document.documentElement.dataset.baseUrl || '/')
      : '/';
  return `${base.replace(/\/+$/, '')}/${src.replace(/^\/+/, '')}`;
}
