import React, {useCallback, useEffect, useRef, useState} from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import AskPanel from './AskPanel';
import {OPEN_ASK} from './AskPrompt';
import styles from './AskLauncher.module.css';

/**
 * A standing way to ask, from any page.
 *
 * The panel at the foot of a lesson is where a student ends up after reading.
 * This is for the other case: they are halfway down, stuck now, and should not
 * have to scroll past the thing confusing them to find the box. It stays out
 * of the way until asked for, which is why it is a mark in the corner rather
 * than a bar across the page.
 */
export default function AskLauncher(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  const logo = useBaseUrl('img/sharp-ai.svg');

  const close = useCallback(() => setOpen(false), []);

  // The lesson footer asks for the chat rather than rendering its own.
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_ASK, onOpen);
    return () => window.removeEventListener(OPEN_ASK, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  return (
    <>
      {open && (
        <div
          className={styles.dock}
          ref={dock}
          role="dialog"
          aria-modal="false"
          aria-label="Ask Sharp AI"
        >
          <div className={styles.dockHead}>
            <img className={styles.dockLogo} src={logo} alt="" width="20" height="20" />
            {/* Sharp AI is its own product; this panel is one place it shows
                up. The link is how a student finds the rest of it. */}
            <a
              className={styles.dockTitle}
              href="https://sharpftc.pages.dev"
              target="_blank"
              rel="noopener noreferrer"
            >
              Sharp AI
              <span className={styles.dockOut} aria-hidden="true"> ↗</span>
            </a>
            <button
              type="button"
              className={styles.dockClose}
              onClick={close}
              aria-label="Close Sharp AI"
            >
              ✕
            </button>
          </div>
          <div className={styles.dockBody}>
            <AskPanel />
          </div>
        </div>
      )}

      <button
        type="button"
        ref={button}
        className={`${styles.launcher} ${open ? styles.launcherOpen : ''}`}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={open ? 'Close Sharp AI' : 'Ask Sharp AI about this page'}
      >
        <img className={styles.mark} src={logo} alt="" width="28" height="28" />
        <span className={styles.label}>Ask</span>
      </button>
    </>
  );
}
