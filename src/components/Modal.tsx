import { useEffect, useState, type ReactNode } from "react";
import "./Modal.css";

export interface ModalAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  primaryAction?: ModalAction;
  children: ReactNode;
}

/**
 * Keep the modal mounted long enough to play its exit animation, then unmount.
 * Must match the longest --modal-exit-* animation in Modal.css.
 */
const EXIT_DURATION_MS = 280;

export function Modal({ open, onClose, title, primaryAction, children }: ModalProps) {
  // `mounted` controls whether the DOM exists; `closing` triggers the exit animation.
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);

  // Sync mount state with the `open` prop, deferring unmount until the exit animation completes.
  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return;
    }
    if (!mounted) return;
    setClosing(true);
    const t = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, EXIT_DURATION_MS);
    return () => window.clearTimeout(t);
  }, [open, mounted]);

  // Body-scroll lock + ESC handler stay active for the whole visible lifetime, including the close anim.
  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [mounted, onClose]);

  if (!mounted) return null;

  const overlayClass = `modal-overlay ${closing ? "modal-overlay--closing" : ""}`;
  const sheetClass = `modal-sheet ${closing ? "modal-sheet--closing" : ""}`;

  return (
    <div className={overlayClass} onClick={onClose}>
      <div
        className={sheetClass}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <header className="modal-header">
          <button type="button" className="modal-action" onClick={onClose}>Cancel</button>
          <h2 id="modal-title" className="modal-title">{title}</h2>
          {primaryAction ? (
            <button
              type="button"
              className="modal-action modal-action--primary"
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
            >
              {primaryAction.label}
            </button>
          ) : (
            <div className="modal-action" />
          )}
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
