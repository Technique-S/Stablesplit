"use client";

import { createContext, useCallback, useContext, useState, ReactNode } from "react";

type ToastKind = "success" | "error" | "info";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: string;
  message: string;
  kind: ToastKind;
  exiting?: boolean;
  action?: ToastAction;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 200);
  }, []);

  const addToast = useCallback(
    (message: string, kind: ToastKind = "success", action?: ToastAction) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, kind, action }]);
      setTimeout(() => removeToast(id), 4000);
    },
    [removeToast]
  );

  const iconMap: Record<ToastKind, string> = {
    success: "✓",
    error: "✕",
    info: "i",
  };

  const bgMap: Record<ToastKind, string> = {
    success: "var(--green)",
    error: "var(--red)",
    info: "var(--blue)",
  };

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      <style>{`
  .toast-action-btn {
    margin-left: auto;
    padding: 0.25rem 0.625rem;
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,0.3);
    background: rgba(255,255,255,0.1);
    color: #fff;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    font-family: "DM Sans", sans-serif;
    white-space: nowrap;
    transition: background 0.15s ease;
  }
  .toast-action-btn:hover {
    background: rgba(255,255,255,0.2);
  }
`}</style>
      {children}
      <div
        style={{
          position: "fixed",
          top: 72,
          right: "1rem",
          zIndex: 200,
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={t.exiting ? "animate-toast-out" : "animate-toast-in"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.625rem",
              padding: "0.75rem 1rem",
              background: bgMap[t.kind],
              color: "#fff",
              borderRadius: 10,
              boxShadow: "var(--shadow-lg)",
              fontSize: "0.875rem",
              fontWeight: 600,
              minWidth: 280,
              maxWidth: 420,
              pointerEvents: "auto",
              cursor: "pointer",
            }}
            onClick={() => removeToast(t.id)}
            role="alert"
          >
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.6875rem",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {iconMap[t.kind]}
            </span>
            {t.message}
            {t.action && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  t.action?.onClick();
                  removeToast(t.id);
                }}
                className="toast-action-btn"
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
