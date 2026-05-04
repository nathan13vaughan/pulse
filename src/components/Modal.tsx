import { useEffect, type ReactNode } from "react";
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

export function Modal({ open, onClose, title, primaryAction, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-sheet"
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
