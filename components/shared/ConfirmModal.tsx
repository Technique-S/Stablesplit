"use client";

import Modal from "@/components/ui/Modal";

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
    <Modal
      open
      onClose={onCancel}
      title={title}
      width={420}
      showClose={false}
      footer={
        <>
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
        </>
      }
    >
      <p style={{ color: "var(--text-2)", fontSize: "0.875rem", lineHeight: 1.5 }}>
        {message}
      </p>
    </Modal>
  );
}
