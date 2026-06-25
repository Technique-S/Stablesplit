"use client";

import { useAccount } from "wagmi";
import { shortenAddress } from "@/lib/domain/members";

interface Props {
  onUse: (wallet: string) => void;
  label?: string;
}

export default function FillWalletButton({ onUse, label = "Use connected" }: Props) {
  const { address, isConnected } = useAccount();
  if (!isConnected || !address) return null;

  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={() => onUse(address)}
      style={{ padding: "0.45rem 0.6rem", fontSize: "0.75rem", whiteSpace: "nowrap" }}
      title={address}
    >
      {label} ({shortenAddress(address)})
    </button>
  );
}
