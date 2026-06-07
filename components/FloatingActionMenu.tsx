"use client";

import { useState, useRef, useEffect, ReactNode } from "react";

export interface FabAction {
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
        bottom: isMobile ? 20 : 24,
        right: isMobile ? 20 : 24,
        zIndex: 60,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 10,
      }}
    >
      {/* Action items */}
      {actions.map((action, i) => (
        <div
          key={action.id}
          style={{
            transition: "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
            opacity: open ? 1 : 0,
            transform: open ? "translateY(0) scale(1)" : `translateY(${(i + 1) * 12}px) scale(0.6)`,
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
              padding: "0.25rem 0.6rem",
              whiteSpace: "nowrap",
              boxShadow: "var(--shadow-sm)",
              opacity: open ? 1 : 0,
              transition: "opacity 0.15s ease 0.1s",
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
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
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
          >
            {action.icon}
          </button>
        </div>
      ))}

      {/* Main FAB */}
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
          fontSize: "1.25rem",
          fontWeight: 700,
          boxShadow: "0 6px 20px var(--blue-shadow)",
          transition: "transform 0.25s ease, box-shadow 0.25s ease, border-radius 0.25s ease",
          transform: open ? "rotate(45deg)" : "rotate(0deg)",
          flexShrink: 0,
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
      >
        +
      </button>
    </div>
  );
}
