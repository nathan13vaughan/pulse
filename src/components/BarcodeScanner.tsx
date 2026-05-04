import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { Modal } from "./Modal";
import "./BarcodeScanner.css";

interface Props {
  open: boolean;
  onClose: () => void;
  onDetected: (barcode: string) => void;
}

export function BarcodeScanner({ open, onClose, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const reader = new BrowserMultiFormatReader();
    setError(null);
    setStarting(true);

    const start = async () => {
      try {
        if (!videoRef.current) return;
        const controls = await reader.decodeFromVideoDevice(
          undefined, // back camera preferred when available
          videoRef.current,
          (result, err) => {
            if (cancelled) return;
            if (result) {
              onDetected(result.getText());
            }
            // err is a NotFoundException between successful reads — ignore.
            if (err && err.name !== "NotFoundException") {
              console.warn("scan error", err);
            }
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (!cancelled) setError(friendlyError(message));
      } finally {
        if (!cancelled) setStarting(false);
      }
    };

    void start();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, onDetected]);

  return (
    <Modal open={open} onClose={onClose} title="Scan barcode">
      <div className="scanner">
        {error ? (
          <div className="card scanner__error">
            <strong>Camera unavailable</strong>
            <p style={{ margin: "var(--sp-xs) 0 0" }}>{error}</p>
          </div>
        ) : (
          <>
            <div className="scanner__viewport">
              <video ref={videoRef} className="scanner__video" playsInline muted />
              <div className="scanner__reticle" aria-hidden />
              {starting ? <div className="scanner__loading muted">Starting camera…</div> : null}
            </div>
            <p className="muted scanner__hint">
              Hold a barcode steady inside the box. Detection happens automatically.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}

function friendlyError(message: string): string {
  if (/permission|denied|notallowed/i.test(message)) {
    return "Camera permission was blocked. Allow camera access for this site in your browser settings.";
  }
  if (/notfound|nodevice/i.test(message)) {
    return "No camera detected on this device.";
  }
  if (/secure|https/i.test(message)) {
    return "Camera access requires HTTPS. Use the deployed site or localhost.";
  }
  return message;
}
