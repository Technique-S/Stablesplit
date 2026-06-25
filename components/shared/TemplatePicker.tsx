"use client";

import { GROUP_TEMPLATES, GroupTemplate } from "@/lib/domain/templates";

interface Props {
  onSelect: (template: GroupTemplate) => void;
}

export default function TemplatePicker({ onSelect }: Props) {
  return (
    <div className="animate-fade-in">
      <h1 style={{ fontSize: "1.625rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "0.375rem" }}>
        Create a Group
      </h1>
      <p style={{ color: "var(--text-2)", fontSize: "0.9375rem", marginBottom: "2rem" }}>
        Pick a template to get started, or start from scratch.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: "0.75rem",
        }}
      >
        {GROUP_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.5rem",
              padding: "1.5rem 1rem",
              borderRadius: 14,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              cursor: "pointer",
              transition: "all 0.15s ease",
              boxShadow: "var(--shadow-sm)",
              fontFamily: "DM Sans, sans-serif",
              textAlign: "center",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--blue)";
              e.currentTarget.style.boxShadow = "var(--shadow-md)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.boxShadow = "var(--shadow-sm)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <span style={{ fontSize: "2rem", lineHeight: 1 }}>{t.emoji}</span>
            <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text)" }}>{t.label}</span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-2)", lineHeight: 1.4 }}>
              {t.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
