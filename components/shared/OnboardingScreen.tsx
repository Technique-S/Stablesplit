"use client";

import Link from "next/link";

export default function OnboardingScreen() {
  return (
    <div className="animate-fade-in" style={{
      maxWidth: 480,
      margin: "0 auto",
      padding: "4rem 1.5rem",
      textAlign: "center",
    }}>
      <div style={{
        width: 80,
        height: 80,
        borderRadius: 20,
        background: "var(--blue-light)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: "0 auto 1.5rem",
      }}>
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <rect x="2" y="2" width="14" height="14" rx="4" stroke="var(--blue)" strokeWidth="2.5"/>
          <rect x="20" y="2" width="14" height="14" rx="4" stroke="var(--blue)" strokeWidth="2.5"/>
          <rect x="2" y="20" width="14" height="14" rx="4" stroke="var(--blue)" strokeWidth="2.5"/>
          <rect x="20" y="20" width="14" height="14" rx="4" stroke="var(--blue)" strokeWidth="2.5"/>
        </svg>
      </div>
      <h1 style={{
        fontSize: "clamp(1.5rem, 4vw, 2rem)",
        fontWeight: 700,
        letterSpacing: "-0.03em",
        color: "var(--text)",
        marginBottom: "0.5rem",
      }}>
        Welcome to StableSplit
      </h1>
      <p style={{ color: "var(--text-2)", fontSize: "0.9375rem", marginBottom: "2rem", lineHeight: 1.5 }}>
        Split expenses effortlessly with friends, track balances, and settle up on-chain.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "2rem" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: "0.75rem",
          padding: "1rem 1.25rem",
          background: "var(--surface-2)",
          borderRadius: 10,
          textAlign: "left",
        }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--blue-light)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="var(--blue)" strokeWidth="1.5"/><circle cx="8" cy="8" r="2" stroke="var(--blue)" strokeWidth="1.5"/></svg>
          </div>
          <div>
            <p style={{ fontWeight: 600, fontSize: "0.875rem" }}>Connect Your Wallet</p>
            <p style={{ color: "var(--text-3)", fontSize: "0.8125rem" }}>Use the button in the top-right to connect</p>
          </div>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: "0.75rem",
          padding: "1rem 1.25rem",
          background: "var(--surface-2)",
          borderRadius: 10,
          textAlign: "left",
        }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--surface-3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="var(--text-2)" strokeWidth="1.5"/><path d="M2 14C2 11.5 4.5 9 8 9C11.5 9 14 11.5 14 14" stroke="var(--text-2)" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
          <div>
            <p style={{ fontWeight: 600, fontSize: "0.875rem" }}>Create Your Profile</p>
            <p style={{ color: "var(--text-3)", fontSize: "0.8125rem" }}>Set your display name and avatar</p>
          </div>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: "0.75rem",
          padding: "1rem 1.25rem",
          background: "var(--surface-2)",
          borderRadius: 10,
          textAlign: "left",
        }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--blue-light)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" stroke="var(--blue)" strokeWidth="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5" stroke="var(--blue)" strokeWidth="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5" stroke="var(--blue)" strokeWidth="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5" stroke="var(--blue)" strokeWidth="1.5"/></svg>
          </div>
          <div>
            <p style={{ fontWeight: 600, fontSize: "0.875rem" }}>Create or Join Groups</p>
            <p style={{ color: "var(--text-3)", fontSize: "0.8125rem" }}>Split expenses with friends</p>
          </div>
        </div>
      </div>

      <Link href="/create" style={{ textDecoration: "none" }}>
        <button className="btn-primary" style={{ width: "100%", justifyContent: "center", padding: "0.75rem" }}>
          Create a Group
        </button>
      </Link>
      <p style={{ color: "var(--text-3)", fontSize: "0.75rem", marginTop: "0.75rem" }}>
        Connect your wallet above to create a profile and get started.
      </p>
    </div>
  );
}