"use client";

import { shortenAddress } from "@/lib/domain/members";

interface WalletBadgeProps {
  wallet?: string;
  noWalletLabel?: string;
  noWalletBackground?: string;
  noWalletColor?: string;
}

export default function WalletBadge({
  wallet,
  noWalletLabel = "No wallet",
  noWalletBackground = "var(--surface-2)",
  noWalletColor = "var(--text-3)",
}: WalletBadgeProps) {
  const copyWallet = async () => {
    if (!wallet) return;
    await navigator.clipboard?.writeText(wallet);
  };

  if (!wallet) {
    return (
      <span className="badge" style={{ background: noWalletBackground, color: noWalletColor }}>
        {noWalletLabel}
      </span>
    );
  }

  return (
    <span className="badge mono" title={wallet} style={{ background: "var(--green-light)", color: "var(--green)", gap: "0.4rem" }}>
      {shortenAddress(wallet)}
      <button
        type="button"
        onClick={copyWallet}
        title="Copy wallet address"
        style={{ border: "none", background: "transparent", color: "inherit", cursor: "pointer", padding: "0", lineHeight: 1 }}
      >
        ⧉
      </button>
    </span>
  );
}
