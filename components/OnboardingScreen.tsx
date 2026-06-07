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
        fontSize: "2.25rem",
      }}>
        ⬡
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
          <span style={{ fontSize: "1.25rem" }}>🔗</span>
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
          <span style={{ fontSize: "1.25rem" }}>👤</span>
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
          <span style={{ fontSize: "1.25rem" }}>⬡</span>
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