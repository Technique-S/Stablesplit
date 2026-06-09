"use client";

import { ReactNode, useEffect, useRef } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  showClose?: boolean;
}

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 540,
  showClose = true,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    modalRef.current?.focus();

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
      prev?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="animate-backdrop"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--overlay)",
          backdropFilter: "blur(4px)",
          zIndex: 100,
        }}
      />
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 101,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "clamp(0.75rem, 3vw, 2rem)",
          pointerEvents: "none",
        }}
      >
        <div
          ref={modalRef}
          tabIndex={-1}
          className="animate-scale-in"
          style={{
            display: "flex",
            flexDirection: "column",
            width: `min(${width}px, 100%)`,
            maxHeight: "min(760px, calc(100dvh - 1.5rem))",
            background: "var(--surface)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-lg)",
            overflow: "hidden",
            pointerEvents: "auto",
            outline: "none",
          }}
        >
          <div
            style={{
              padding: "1.5rem 1.75rem 1.25rem",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "1rem",
              flexShrink: 0,
            }}
          >
            <div>
              <h2 style={{ fontWeight: 700, fontSize: "1.125rem", letterSpacing: "-0.02em" }}>
                {title}
              </h2>
              {subtitle && (
                <p style={{ color: "var(--text-2)", fontSize: "0.8125rem", marginTop: "0.125rem" }}>
                  {subtitle}
                </p>
              )}
            </div>
            {showClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-2)",
                  fontSize: "1.25rem",
                  lineHeight: 1,
                  flexShrink: 0,
                  transition: "all 0.15s ease",
                  fontFamily: "DM Sans, sans-serif",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--surface-3)";
                  e.currentTarget.style.color = "var(--text)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--surface-2)";
                  e.currentTarget.style.color = "var(--text-2)";
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>

          <div style={{ padding: "1.5rem 1.75rem", overflowY: "auto", flex: 1, minHeight: 0 }}>
            {children}
          </div>

          {footer && (
            <div
              style={{
                padding: "1.25rem 1.75rem",
                borderTop: "1px solid var(--border)",
                display: "flex",
                gap: "0.75rem",
                justifyContent: "flex-end",
                flexWrap: "wrap",
                flexShrink: 0,
                background: "var(--surface)",
              }}
            >
              {footer}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
