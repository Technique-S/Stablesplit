"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useTheme } from "./ThemeProvider";
import WalletConnectButton from "./WalletConnectButton";
import NotificationBell from "./NotificationBell";
import { useProfileCheck } from "@/lib/use-profile-check";

export default function Navbar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const { status: profileStatus, profile } = useProfileCheck();
  const hasProfile = profileStatus === "has-profile";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const profileInitials = profile
    ? profile.displayName.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?"
    : null;
  const profileAvatar = profile?.avatarURL ?? null;

  const linkStyle = (target: string): React.CSSProperties => ({
    fontSize: "0.875rem",
    fontWeight: 500,
    color: pathname === target ? "var(--blue)" : "var(--text-2)",
    padding: "0.375rem 0.75rem",
    borderRadius: 6,
    background: pathname === target ? "var(--blue-light)" : "transparent",
    transition: "all 0.15s ease",
    textDecoration: "none",
    whiteSpace: "nowrap",
  });

  const navStyle: React.CSSProperties = {
    background: scrolled
      ? (isDark ? "rgba(15,15,15,0.60)" : "rgba(255,255,255,0.40)")
      : "var(--nav-bg)",
    backdropFilter: scrolled ? "blur(30px) saturate(1.4)" : "blur(16px)",
    WebkitBackdropFilter: scrolled ? "blur(30px) saturate(1.4)" : "blur(16px)",
    borderBottom: scrolled ? "1px solid var(--nav-border)" : "1px solid transparent",
    position: "sticky" as const,
    top: 0,
    zIndex: 50,
    transition: "background 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), backdrop-filter 0.25s ease, border-color 0.25s ease",
  };

  return (
    <>
      <style>{`
        .nav-icon-btn {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .nav-icon-btn:hover {
          background: var(--surface-3);
          border-color: var(--border-hover);
        }
        .nav-icon-btn:active {
          transform: scale(0.93);
        }
        .nav-mobile-item {
          padding: 0.75rem;
          border-radius: 8px;
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
          transition: background 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .nav-mobile-item:hover {
          background: var(--surface-2);
        }
      `}</style>
      <nav style={navStyle}>
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "0 1.5rem",
            height: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
            <div
              style={{
                width: 32,
                height: 32,
                background: "var(--blue)",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.3s ease",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M3 9L9 3L15 9L9 15L3 9Z" stroke="var(--on-brand)" strokeWidth="1.5" strokeLinejoin="round" />
                <circle cx="9" cy="9" r="2" fill="var(--on-brand)" />
              </svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text)", letterSpacing: "-0.02em" }}>
              StableSplit
            </span>
          </Link>

          {isMobile ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <NotificationBell />
              <WalletConnectButton />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                className="nav-icon-btn"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  {mobileMenuOpen ? (
                    <path d="M4 4L14 14M4 14L14 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  ) : (
                    <>
                      <path d="M3 5H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M3 9H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M3 13H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <Link href="/" style={linkStyle("/")}>
                Groups
              </Link>
              {hasProfile && (
                <Link href="/create" style={{ textDecoration: "none" }}>
                  <span className="btn-primary" style={{ padding: "0.4rem 1rem", fontSize: "0.8125rem" }}>
                    + New Group
                  </span>
                </Link>
              )}
              {hasProfile && (
                <Link href="/profile" style={{ textDecoration: "none" }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: profileAvatar ? "transparent" : "var(--surface-2)",
                      border: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      overflow: "hidden",
                      transition: "border-color 0.15s, opacity 0.15s",
                      opacity: pathname === "/profile" ? 0.7 : 1,
                    }}
                    title="Profile"
                  >
                    {profileAvatar ? (
                      <img src={profileAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                    ) : (
                      <span style={{ fontSize: "0.6875rem", color: "var(--text-2)", fontWeight: 700 }}>
                        {profileInitials || "?"}
                      </span>
                    )}
                  </div>
                </Link>
              )}
              <NotificationBell />
              <WalletConnectButton />
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                title={isDark ? "Light mode" : "Dark mode"}
                className="nav-icon-btn"
              >
                {isDark ? (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
                    <path d="M12 2V5M12 19V22M22 12H19M5 12H2M19.1 4.9L17 7M7 17L4.9 19.1M19.1 19.1L17 17M7 7L4.9 4.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M21 13.2A8.2 8.2 0 0 1 10.8 3a7 7 0 1 0 10.2 10.2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>

        {isMobile && mobileMenuOpen && (
          <div
            className="animate-slide-in"
            style={{
              borderTop: "1px solid var(--border)",
              background: isDark ? "rgba(26,26,26,0.92)" : "rgba(255,255,255,0.85)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              padding: "0.75rem 1rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <Link
              href="/"
              className="nav-mobile-item"
              style={{
                ...linkStyle("/"),
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              Groups
            </Link>
            {hasProfile && (
              <>
                <Link
                  href="/create"
                  className="nav-mobile-item"
                  style={{
                    ...linkStyle("/create"),
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  New Group
                </Link>
                <Link
                  href="/profile"
                  className="nav-mobile-item"
                  style={{
                    ...linkStyle("/profile"),
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M2 14C2 11.5 4.5 9 8 9C11.5 9 14 11.5 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  Profile
                </Link>
              </>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              className="nav-mobile-item"
              style={{
                background: "transparent",
                color: "var(--text-2)",
                border: "none",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontFamily: "DM Sans, sans-serif",
                textAlign: "left",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                {isDark ? (
                  <>
                    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
                    <path d="M12 2V5M12 19V22M22 12H19M5 12H2M19.1 4.9L17 7M7 17L4.9 19.1M19.1 19.1L17 17M7 7L4.9 4.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </>
                ) : (
                  <path d="M21 13.2A8.2 8.2 0 0 1 10.8 3a7 7 0 1 0 10.2 10.2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                )}
              </svg>
              {isDark ? "Light Mode" : "Dark Mode"}
            </button>
          </div>
        )}
      </nav>
    </>
  );
}
