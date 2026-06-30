"use client";

import { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  color?: string;
  className?: string;
  layout?: "row" | "column";
  compact?: boolean;
}

export default function StatCard({
  label,
  value,
  icon,
  color,
  className = "",
  layout = "column",
  compact = false,
}: StatCardProps) {
  if (compact) {
    return (
      <div style={{ padding: "0.75rem", borderRadius: 8, background: "var(--surface-2)", textAlign: "center" }}>
        <div className="mono" style={{ fontWeight: 700, fontSize: "0.9375rem", color: color ?? "var(--text)" }}>
          {value}
        </div>
        <div style={{ fontSize: "0.6875rem", color: "var(--text-3)", marginTop: "0.125rem", fontWeight: 600 }}>
          {label}
        </div>
      </div>
    );
  }

  if (layout === "row") {
    return (
      <div className={`card ${className}`} style={{ padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
        {icon && (
          <div style={{ width: 40, height: 40, background: color ? `${color}18` : "var(--surface-2)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {icon}
          </div>
        )}
        <div>
          <div className="mono" style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
            {value}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-2)", fontWeight: 500 }}>
            {label}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: compact ? "0.75rem" : "1.25rem 1.5rem", textAlign: "center" }}>
      {icon && (
        <div style={{ width: 28, height: 28, margin: "0 auto 0.5rem", borderRadius: 8, background: color ? `${color}18` : "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem" }}>
          {icon}
        </div>
      )}
      <div className="mono" style={{ fontWeight: 700, fontSize: icon ? "0.9375rem" : "1.5rem", color: color ?? "var(--text)" }}>
        {value}
      </div>
      <div style={{ fontSize: icon ? "0.6875rem" : "0.75rem", color: "var(--text-3)", marginTop: "0.125rem", fontWeight: icon ? 600 : 500 }}>
        {label}
      </div>
    </div>
  );
}
