import { useEffect, useRef, useState, type ReactNode, type TouchEvent as ReactTouchEvent } from "react";
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
  /** Sheet fills the viewport instead of sizing to content. */
  tall?: boolean;
}

const EXIT_DURATION_MS = 280;
/** Drag distance past which a release dismisses the sheet (instead of springing back). */
const DISMISS_THRESHOLD_PX = 100;

export function Modal({ open, onClose, title, primaryAction, children, tall = false }: ModalProps) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);

  // Drag-to-dismiss: live offset while the user pulls the handle/header down.
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStateRef = useRef<{ startY: number; active: boolean }>({ startY: 0, active: false });

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
      setDragOffset(0);
    }, EXIT_DURATION_MS);
    return () => window.clearTimeout(t);
  }, [open, mounted]);

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

  // --- drag-to-dismiss handlers ---

  const onTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    const target = e.target as HTMLElement;
    // Only activate when the gesture starts on the header/handle area, so
    // scrolling the modal body doesn't accidentally dismiss the sheet.
    if (!target.closest(".modal-header")) return;
    const t = e.touches[0]!;
    dragStateRef.current = { startY: t.clientY, active: true };
    setDragging(true);
  };

  const onTouchMove = (e: ReactTouchEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.active) return;
    const t = e.touches[0]!;
    const dy = t.clientY - dragStateRef.current.startY;
    setDragOffset(Math.max(0, dy));
  };

  const onTouchEnd = () => {
    if (!dragStateRef.current.active) return;
    dragStateRef.current.active = false;
    setDragging(false);
    if (dragOffset > DISMISS_THRESHOLD_PX) {
      // Let the close animation pick up from the dragged position. We keep
      // the inline style off so the CSS class's transform takes over.
      setDragOffset(0);
      onClose();
    } else {
      setDragOffset(0); // snap back, transition handles the smooth return
    }
  };

  if (!mounted) return null;

  const overlayClass = `modal-overlay ${closing ? "modal-overlay--closing" : ""}`;
  const sheetClass = [
    "modal-sheet",
    tall ? "modal-sheet--tall" : "",
    closing ? "modal-sheet--closing" : "",
    dragging ? "modal-sheet--dragging" : "",
  ].filter(Boolean).join(" ");

  // Apply drag transform inline (overrides CSS) while actively dragging or
  // mid-spring-back. When dragOffset is 0, fall back to the class-driven transform.
  const dragStyle = dragOffset > 0
    ? { transform: `translateY(${dragOffset}px) scale(${1 - Math.min(dragOffset, 200) / 2000})` }
    : undefined;

  return (
    <div className={overlayClass} onClick={onClose}>
      <div
        className={sheetClass}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        style={dragStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <header className="modal-header">
          <span className="modal-handle" aria-hidden="true" />
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
