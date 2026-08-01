import React, { useCallback, useEffect, useState } from "react";
import { Icon } from "./Icon";

export type ToastTone = "success" | "error";
export type ToastItem = { id: number; message: string; tone: ToastTone };

const AUTO_DISMISS_MS = 6000;

let nextToastId = 0;

/**
 * Notificaciones transitorias.
 *
 * Antes existía un único estado `message` que servía a la vez para éxitos y
 * para errores de login, no se limpiaba nunca y quedaba incrustado en el flujo
 * del contenido: al cerrar sesión, el aviso de "incidencia resuelta" reaparecía
 * en rojo bajo el formulario de acceso.
 */
export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const push = useCallback((message: string, tone: ToastTone = "success") => {
    if (!message) return;
    nextToastId += 1;
    const id = nextToastId;
    setToasts(prev => [...prev, { id, message, tone }]);
  }, []);

  const clear = useCallback(() => setToasts([]), []);

  return { toasts, push, dismiss, clear };
}

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    // Los errores permanecen hasta que el usuario los cierra; los éxitos se van solos.
    if (toast.tone === "error") return;
    const timer = window.setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.tone, onDismiss]);

  return (
    <div className={`toast toast-${toast.tone}`} role="alert">
      <Icon name={toast.tone === "success" ? "check" : "alert"} />
      <span className="toast-message">{toast.message}</span>
      <button type="button" className="toast-close" onClick={() => onDismiss(toast.id)} aria-label="Cerrar notificación">
        ×
      </button>
    </div>
  );
}

export function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-stack">
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

export default ToastStack;
