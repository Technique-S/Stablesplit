"use client";

import { useState, useRef, useEffect, ReactNode } from "react";

interface AccordionSectionProps {
  title: string;
  subtitle?: string;
  defaultExpanded?: boolean;
  badge?: ReactNode;
  children: ReactNode;
}

export default function AccordionSection({
  title,
  subtitle,
  defaultExpanded = false,
  badge,
  children,
}: AccordionSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number>(0);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [children]);

  return (
    <div
      className="card animate-fade-in"
      style={{
        marginBottom: "1.25rem",
        overflow: "hidden",
        transition: "border-color 0.25s ease",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          padding: "1.25rem 1.5rem",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          color: "var(--text)",
          fontFamily: "DM Sans, sans-serif",
          textAlign: "left",
          transition: "background-color 0.15s ease",
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-2)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", minWidth: 0, flex: 1 }}>
          <div style={{
            width: 20, height: 20, borderRadius: 6,
            background: "var(--surface-2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
            transition: "transform 0.25s ease",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
          }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M3 1L7 5L3 9" stroke="var(--text-2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontWeight: 700, fontSize: "0.9375rem", letterSpacing: "-0.01em", color: "var(--text)" }}>
              {title}
            </p>
            {subtitle && (
              <p style={{ color: "var(--text-3)", fontSize: "0.75rem", marginTop: "0.0625rem" }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {badge && <div style={{ flexShrink: 0 }}>{badge}</div>}
      </button>

      <div
        style={{
          display: "grid",
          gridTemplateRows: expanded ? "1fr" : "0fr",
          transition: "grid-template-rows 0.3s ease",
        }}
      >
        <div ref={contentRef} style={{ overflow: "hidden" }}>
          <div style={{ padding: expanded ? "0 1.5rem 1.25rem" : "0 1.5rem" }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
