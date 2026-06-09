"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const sizeClasses = {
  sm: { padding: "0.4rem 1rem", fontSize: "0.8125rem" },
  md: { padding: "0.625rem 1.25rem", fontSize: "0.875rem" },
  lg: { padding: "0.75rem 1.5rem", fontSize: "0.9375rem" },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, disabled, children, style, ...props }, ref) => {
    const base: React.CSSProperties = {
      borderRadius: "var(--radius-sm)",
      fontWeight: 600,
      letterSpacing: "-0.01em",
      border: variant === "secondary" || variant === "ghost" ? "1px solid var(--border)" : "none",
      cursor: disabled || loading ? "not-allowed" : "pointer",
      display: "inline-flex",
      alignItems: "center",
      gap: "0.5rem",
      fontFamily: "DM Sans, sans-serif",
      WebkitTapHighlightColor: "transparent",
      userSelect: "none",
      opacity: disabled || loading ? 0.6 : 1,
      ...sizeClasses[size],
      ...style,
    };

    const variants: Record<string, React.CSSProperties> = {
      primary: {
        background: "var(--blue)",
        color: "var(--on-brand)",
        transition: "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      secondary: {
        background: "var(--surface-2)",
        color: "var(--text)",
        transition: "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      ghost: {
        background: "transparent",
        color: "var(--text-2)",
        transition: "all 0.15s ease",
      },
      danger: {
        background: "var(--red)",
        color: "var(--on-brand)",
        transition: "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className="btn-base"
        style={{ ...base, ...variants[variant] }}
        onMouseEnter={(e) => {
          if (disabled || loading) return;
          if (variant === "primary") {
            e.currentTarget.style.background = "var(--blue-hover)";
            e.currentTarget.style.boxShadow = "0 4px 12px var(--blue-shadow)";
            e.currentTarget.style.transform = "translateY(-1px)";
          } else if (variant === "secondary") {
            e.currentTarget.style.background = "var(--surface-3)";
            e.currentTarget.style.borderColor = "var(--border-hover)";
          } else if (variant === "ghost") {
            e.currentTarget.style.background = "var(--surface-2)";
          }
        }}
        onMouseLeave={(e) => {
          if (disabled || loading) return;
          if (variant === "primary") {
            e.currentTarget.style.background = "var(--blue)";
            e.currentTarget.style.boxShadow = "none";
            e.currentTarget.style.transform = "none";
          } else if (variant === "secondary") {
            e.currentTarget.style.background = "var(--surface-2)";
            e.currentTarget.style.borderColor = "var(--border)";
          } else if (variant === "ghost") {
            e.currentTarget.style.background = "transparent";
          }
        }}
        onMouseDown={(e) => {
          if (disabled || loading) return;
          e.currentTarget.style.transform = "scale(0.97)";
        }}
        onMouseUp={(e) => {
          if (disabled || loading) return;
          if (variant === "primary") {
            e.currentTarget.style.transform = "translateY(-1px)";
          } else {
            e.currentTarget.style.transform = "none";
          }
        }}
        {...props}
      >
        {loading && <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
