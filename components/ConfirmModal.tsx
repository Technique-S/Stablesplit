"use client";

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirm",
  loading = false,
  danger = false,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <>
      <div
        onClick={onCancel}
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--overlay)",
          backdropFilter: "blur(4px)",
          zIndex: 120,
        }}
      />
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 121,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          pointerEvents: "none",
        }}
      >
        <div
          className="card animate-scale-in"
          style={{
            width: "min(420px, 100%)",
            padding: "1.5rem",
            pointerEvents: "auto",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <h2 style={{ fontWeight: 700, fontSize: "1.125rem", letterSpacing: "-0.02em", marginBottom: "0.5rem" }}>
            {title}
          </h2>
          <p style={{ color: "var(--text-2)", fontSize: "0.875rem", lineHeight: 1.5 }}>
            {message}
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem", flexWrap: "wrap" }}>
            <button type="button" onClick={onCancel} className="btn-secondary" disabled={loading}>
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="btn-primary"
              style={{
                background: danger ? "var(--red)" : "var(--blue)",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Working..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
