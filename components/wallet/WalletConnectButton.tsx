"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppKit, useAppKitAccount, useAppKitNetwork } from "@reown/appkit/react";
import { useDisconnect } from "@reown/appkit-controllers/react";
import { useWalletReady } from "./WalletProvider";
import {
  ARC_TESTNET_FAUCET_URL,
  ARC_TESTNET_GAS_TRACKER_URL,
  ARC_TESTNET_ID,
  addArcTestnetToInjectedWallet,
  arcTestnet,
  shortAddress,
  walletEnabled,
} from "@/lib/web3/wallet";

export default function WalletConnectButton() {
  const walletReady = useWalletReady();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !walletReady) {
    return (
      <button type="button" className="btn-secondary" disabled style={{ padding: "0.4rem 0.85rem", fontSize: "0.8125rem" }}>
        Wallet
      </button>
    );
  }

  return <WalletConnectInner />;
}

function WalletConnectInner() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { open } = useAppKit();
  const { address, isConnected, status } = useAppKitAccount();
  const { chainId, switchNetwork } = useAppKitNetwork();
  const { disconnect } = useDisconnect();

  const onArcTestnet = Number(chainId) === ARC_TESTNET_ID;
  const displayAddress = useMemo(() => shortAddress(address), [address]);

  const handleConnect = async () => {
    if (!walletEnabled) {
      setError("Add NEXT_PUBLIC_REOWN_PROJECT_ID to .env.local to enable wallet connections.");
      return;
    }
    setError("");
    await open({ view: "Connect" });
  };

  const handleSwitchNetwork = async () => {
    setLoading(true);
    setError("");
    try {
      await switchNetwork(arcTestnet);
    } catch (switchError) {
      try {
        await addArcTestnetToInjectedWallet();
      } catch (addError) {
        const message = addError instanceof Error ? addError.message : "Unable to add Arc Testnet.";
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    setError("");
    try {
      await disconnect({ namespace: "eip155" });
      setMenuOpen(false);
    } catch (disconnectError) {
      setError("Unable to disconnect wallet.");
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={handleConnect}
          className="btn-secondary"
          disabled={status === "connecting"}
          style={{ padding: "0.4rem 0.85rem", fontSize: "0.8125rem" }}
        >
          {status === "connecting" ? "Connecting..." : "Connect Wallet"}
        </button>
        {error && (
          <div
            className="card"
            style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 0.5rem)",
              width: "min(280px, calc(100vw - 2rem))",
              padding: "0.75rem",
              color: "var(--red)",
              fontSize: "0.75rem",
              zIndex: 60,
            }}
          >
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setMenuOpen((openMenu) => !openMenu)}
        className="btn-secondary"
        style={{
          padding: "0.4rem 0.85rem",
          fontSize: "0.8125rem",
          borderColor: onArcTestnet ? "var(--success-border)" : "var(--error-border)",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: onArcTestnet ? "var(--green)" : "var(--red)",
          }}
        />
        {displayAddress}
      </button>

      {menuOpen && (
        <div
          className="card animate-scale-in"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 0.5rem)",
            width: "min(300px, calc(100vw - 2rem))",
            padding: "1rem",
            zIndex: 60,
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <div style={{ marginBottom: "0.75rem" }}>
            <p style={{ fontSize: "0.75rem", color: "var(--text-3)", fontWeight: 600 }}>Connected wallet</p>
            <p className="mono" style={{ fontSize: "0.875rem", color: "var(--text)", marginTop: "0.25rem", wordBreak: "break-all" }}>
              {address}
            </p>
          </div>

          <div style={{ padding: "0.75rem", borderRadius: 8, background: "var(--surface-2)", marginBottom: "0.75rem" }}>
            <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: onArcTestnet ? "var(--green)" : "var(--red)" }}>
              {onArcTestnet ? "Arc Testnet connected" : "Wrong network"}
            </p>
            <p style={{ fontSize: "0.75rem", color: "var(--text-2)", marginTop: "0.25rem" }}>
              Arc Testnet uses chain ID {ARC_TESTNET_ID} and USDC for gas.
            </p>
          </div>

          {!onArcTestnet && (
            <button
              type="button"
              onClick={handleSwitchNetwork}
              className="btn-primary"
              disabled={loading}
              style={{ width: "100%", justifyContent: "center", marginBottom: "0.5rem" }}
            >
              {loading ? "Switching..." : "Switch to Arc Testnet"}
            </button>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <a className="btn-secondary" href={ARC_TESTNET_FAUCET_URL} target="_blank" rel="noreferrer" style={{ justifyContent: "center", textDecoration: "none", padding: "0.5rem" }}>
              Faucet
            </a>
            <a className="btn-secondary" href={ARC_TESTNET_GAS_TRACKER_URL} target="_blank" rel="noreferrer" style={{ justifyContent: "center", textDecoration: "none", padding: "0.5rem" }}>
              Gas
            </a>
          </div>

          <button
            type="button"
            onClick={handleDisconnect}
            className="btn-secondary"
            disabled={loading}
            style={{ width: "100%", justifyContent: "center", color: "var(--red)" }}
          >
            Disconnect
          </button>

          {error && (
            <p style={{ marginTop: "0.75rem", color: "var(--red)", fontSize: "0.75rem", lineHeight: 1.4 }}>
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
