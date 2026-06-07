"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "./ThemeProvider";
import WalletConnectButton from "./WalletConnectButton";
import NotificationBell from "./NotificationBell";
import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { getProfileId } from "@/lib/local-profile";
import { getProfile } from "@/lib/profile";

export default function Navbar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const { address } = useAccount();
  const [profileInitials, setProfileInitials] = useState<string | null>(null);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);

  useEffect(() => {
    const pid = getProfileId(address);
    if (!pid) {
      setProfileInitials(null);
      setProfileAvatar(null);
      return;
    }
    getProfile(pid).then((p) => {
      if (p) {
        const initials = p.displayName.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
        setProfileInitials(initials);
        setProfileAvatar(p.avatarURL ?? null);
      } else {
        setProfileInitials(null);
        setProfileAvatar(null);
      }
    }).catch(() => {});
  }, [address]);

  return (
    <nav
      style={{
        background: "var(--nav-bg)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--border)",
        position: "sticky",
        top: 0,
        zIndex: 50,
        transition: "background-color 0.25s ease, border-color 0.25s ease",
      }}
    >
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
        {/* Logo */}
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div
            style={{
              width: 32,
              height: 32,
              background: "var(--blue)",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
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

        {/* Nav links */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <span
              style={{
                fontSize: "0.875rem",
                fontWeight: 500,
                color: pathname === "/" ? "var(--blue)" : "var(--text-2)",
                padding: "0.375rem 0.75rem",
                borderRadius: 6,
                background: pathname === "/" ? "var(--blue-light)" : "transparent",
                transition: "all 0.15s",
              }}
            >
              Groups
            </span>
          </Link>
          <Link href="/create" style={{ textDecoration: "none" }}>
            <span className="btn-primary" style={{ padding: "0.4rem 1rem", fontSize: "0.8125rem" }}>
              + New Group
            </span>
          </Link>
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
          <NotificationBell />
          <WalletConnectButton />
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            title={isDark ? "Light mode" : "Dark mode"}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              color: "var(--text)",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease, transform 0.2s ease",
            }}
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
      </div>
    </nav>
  );
}
