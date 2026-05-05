import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { haptic } from "../services/haptics";
import "./AlertSheet.css";

export interface AlertOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

type AlertResolver = (confirmed: boolean) => void;

const AlertContext = createContext<((opts: AlertOptions) => Promise<boolean>) | null>(null);

export function AlertProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [opts, setOpts] = useState<AlertOptions | null>(null);
  const resolverRef = useRef<AlertResolver | null>(null);

  const finish = useCallback((confirmed: boolean) => {
    setClosing(true);
    if (confirmed && opts?.destructive) haptic.warn();
    window.setTimeout(() => {
      resolverRef.current?.(confirmed);
      resolverRef.current = null;
      setOpen(false);
      setClosing(false);
      setOpts(null);
    }, 220);
  }, [opts]);

  const confirm = useCallback((options: AlertOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOpts(options);
      setOpen(true);
      setClosing(false);
    });
  }, []);

  return (
    <AlertContext.Provider value={confirm}>
      {children}
      {open && opts ? (
        <div
          className={`alert-overlay ${closing ? "alert-overlay--closing" : ""}`}
          onClick={() => finish(false)}
        >
          <div
            className={`alert-sheet ${closing ? "alert-sheet--closing" : ""}`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="alert-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="alert-body">
              <h3 id="alert-title" className="alert-title">{opts.title}</h3>
              {opts.message ? <p className="alert-message">{opts.message}</p> : null}
            </div>
            <div className="alert-actions">
              <button
                type="button"
                className={`alert-btn ${opts.destructive ? "alert-btn--destructive" : "alert-btn--primary"}`}
                onClick={() => finish(true)}
              >
                {opts.confirmLabel ?? "Confirm"}
              </button>
              <button
                type="button"
                className="alert-btn alert-btn--cancel"
                onClick={() => finish(false)}
              >
                {opts.cancelLabel ?? "Cancel"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AlertContext.Provider>
  );
}

/** Hook returning a `confirm()` function that resolves true/false. */
export function useAlert(): (opts: AlertOptions) => Promise<boolean> {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error("useAlert must be used within an AlertProvider");
  return ctx;
}
