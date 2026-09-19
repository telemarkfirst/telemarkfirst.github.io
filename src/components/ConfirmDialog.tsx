import React, {useEffect, useId, useRef} from 'react';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  danger?: boolean;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
  danger = false,
}: ConfirmDialogProps): React.JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      cancelRef.current?.focus();
    } else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => { event.preventDefault(); onCancel(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onCancel(); }}
    >
      <span className={danger ? styles.dangerIcon : styles.icon} aria-hidden="true">{danger ? '!' : '\u21ba'}</span>
      <h2 id={titleId}>{title}</h2>
      <p id={descriptionId}>{description}</p>
      <div className={styles.actions}>
        <button ref={cancelRef} type="button" className={styles.cancel} onClick={onCancel}>Cancel</button>
        <button type="button" className={danger ? styles.danger : styles.confirm} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </dialog>
  );
}
