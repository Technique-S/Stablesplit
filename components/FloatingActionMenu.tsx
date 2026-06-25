"use client";

import { useState, useRef, useEffect, ReactNode } from "react";

interface FabAction {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  color?: string;
}

interface FloatingActionMenuProps {
  actions: FabAction[];
}

export default function FloatingActionMenu({ actions }: FloatingActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const fabSize = 52;

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        bottom: isMobile ? 28 : 24,
        right: isMobile ? 20 : 24,
        zIndex: 60,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 10,
      }}
    >
      {actions.map((action, i) => (
        <div
          key={action.id}
          style={{
            transition: "all 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)",
            opacity: open ? 1 : 0,
            transform: open ? "translateY(0) scale(1)" : `translateY(${(i + 1) * 14}px) scale(0.5)`,
            pointerEvents: open ? "auto" : "none",
            display: "flex",
            alignItems: "center",
            gap: 8,
            position: "relative",
            zIndex: 1,
          }}
        >
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "var(--text)",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "0.3rem 0.7rem",
              whiteSpace: "nowrap",
              boxShadow: "var(--shadow-md)",
              opacity: open ? 1 : 0,
              transition: "opacity 0.15s ease 0.08s",
              pointerEvents: "none",
            }}
          >
            {action.label}
          </span>
          <button
            type="button"
            onClick={() => {
              action.onClick();
              setOpen(false);
            }}
            title={action.label}
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              border: "none",
              background: action.color ?? "var(--blue)",
              color: "var(--on-brand)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1rem",
              boxShadow: action.color
                ? `0 4px 12px ${action.color}40`
                : "0 4px 12px var(--blue-shadow)",
              transition: "transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease",
              WebkitTapHighlightColor: "transparent",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.08)";
              e.currentTarget.style.boxShadow = action.color
                ? `0 6px 16px ${action.color}50`
                : "0 6px 16px var(--blue-shadow)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = action.color
                ? `0 4px 12px ${action.color}40`
                : "0 4px 12px var(--blue-shadow)";
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = "scale(0.93)";
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = "scale(1.08)";
            }}
          >
            {action.icon}
          </button>
        </div>
      ))}

      <button
        ref={fabRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? "Close menu" : "Open menu"}
        title={open ? "Close" : "Actions"}
        style={{
          width: fabSize,
          height: fabSize,
          borderRadius: 16,
          border: "none",
          background: "var(--blue)",
          color: "var(--on-brand)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.375rem",
          fontWeight: 700,
          boxShadow: "0 6px 20px var(--blue-shadow)",
          transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease, border-radius 0.3s ease",
          transform: open ? "rotate(45deg)" : "rotate(0deg)",
          flexShrink: 0,
          WebkitTapHighlightColor: "transparent",
        }}
        onMouseEnter={(e) => {
          if (!open) {
            e.currentTarget.style.transform = "scale(1.06)";
            e.currentTarget.style.boxShadow = "0 8px 24px var(--blue-shadow)";
          }
        }}
        onMouseLeave={(e) => {
          if (!open) {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 6px 20px var(--blue-shadow)";
          }
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.transform = open ? "rotate(45deg) scale(0.93)" : "scale(0.93)";
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = open ? "rotate(45deg) scale(1.06)" : "scale(1.06)";
        }}
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M11 3V19M3 11H19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
