"use client";

import { FormEvent, useState } from "react";
import { useAccount } from "wagmi";
import { updateMemberWallet } from "@/lib/db";
import { Group, Member } from "@/lib/types";
import { shortenAddress, validateEvmAddress } from "@/lib/members";
import { useWalletReady } from "./WalletProvider";

interface Props {
  group: Group;
  member: Member;
  onClose: () => void;
  onSaved: (group: Group) => void;
}

export default function MemberWalletModal({ group, member, onClose, onSaved }: Props) {
  const walletReady = useWalletReady();
  const [wallet, setWallet] = useState(member.walletAddress ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = wallet.trim();

    if (!trimmed) {
      setError("Enter a wallet address.");
      return;
    }

    if (!validateEvmAddress(trimmed)) {
      setError("Enter a valid EVM wallet address.");
      return;
    }

    const optimisticMembers = group.members.map((existing) =>
      existing.id === member.id ? { ...existing, walletAddress: trimmed } : existing
    );

    setLoading(true);
    setError("");
    onSaved({
      ...group,
      members: optimisticMembers,
      memberWallets: {
        ...(group.memberWallets ?? {}),
        [member.id]: trimmed,
        [member.displayName]: trimmed,
      },
    });

    try {
      const updatedGroup = await updateMemberWallet(group.id, member.id, trimmed);
      if (updatedGroup) onSaved(updatedGroup);
      onClose();
    } catch (saveError) {
      setError("Failed to save wallet address.");
      onSaved(group);
      setLoading(false);
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--overlay)",
          backdropFilter: "blur(4px)",
          zIndex: 100,
        }}
      />
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 101,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "clamp(0.75rem, 3vw, 2rem)",
          pointerEvents: "none",
        }}
      >
        <form
          onSubmit={handleSubmit}
          className="animate-scale-in"
          style={{
            width: "min(480px, 100%)",
            maxHeight: "calc(100dvh - 1.5rem)",
            overflow: "hidden",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-lg)",
            pointerEvents: "auto",
          }}
        >
          <div style={{ padding: "1.5rem 1.75rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", gap: "1rem" }}>
            <div>
              <h2 style={{ fontWeight: 700, fontSize: "1.125rem", letterSpacing: "-0.02em" }}>
                {member.walletAddress ? "Edit Wallet" : "Add Wallet"}
              </h2>
              <p style={{ color: "var(--text-2)", fontSize: "0.8125rem", marginTop: "0.125rem" }}>
                {member.displayName}
              </p>
            </div>
            <button type="button" onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--border)", cursor: "pointer", color: "var(--text-2)", fontSize: "1.25rem", lineHeight: 1, flexShrink: 0 }}>
              ×
            </button>
          </div>

          <div style={{ padding: "1.5rem 1.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.875rem", flexWrap: "wrap" }}>
              <span className="badge" style={{ background: member.walletAddress ? "var(--green-light)" : "var(--red-light)", color: member.walletAddress ? "var(--green)" : "var(--red)" }}>
                {member.walletAddress ? "Wallet linked" : "No wallet"}
              </span>
              {member.walletAddress && (
                <span className="mono" style={{ color: "var(--text-2)", fontSize: "0.75rem", fontWeight: 700 }}>
                  {shortenAddress(member.walletAddress)}
                </span>
              )}
            </div>

            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.5rem" }}>
              Wallet Address
            </label>
            <input
              className="input-field mono"
              placeholder="0x..."
              value={wallet}
              onChange={(event) => {
                setWallet(event.target.value);
                setError("");
              }}
              style={{ fontSize: "0.8125rem" }}
            />

            {walletReady && (
              <ConnectedWalletFill onUse={(address) => {
                setWallet(address);
                setError("");
              }} />
            )}

            {error && (
              <div style={{ marginTop: "1rem", padding: "0.75rem 1rem", background: "var(--red-light)", border: "1px solid var(--error-border)", borderRadius: 8, color: "var(--red)", fontSize: "0.8125rem", fontWeight: 600 }}>
                {error}
              </div>
            )}
          </div>

          <div style={{ padding: "1.25rem 1.75rem", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: "0.75rem", flexWrap: "wrap" }}>
            <button type="button" onClick={onClose} className="btn-secondary" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading} style={{ opacity: loading ? 0.7 : 1 }}>
              {loading ? "Saving..." : "Save Wallet"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

function ConnectedWalletFill({ onUse }: { onUse: (address: string) => void }) {
  const { address, isConnected } = useAccount();

  if (!isConnected || !address) return null;

  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={() => onUse(address)}
      style={{ marginTop: "0.75rem", padding: "0.5rem 0.75rem", fontSize: "0.8125rem" }}
    >
      Use Connected Wallet
    </button>
  );
}
