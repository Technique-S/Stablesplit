"use client";

import { useCallback, useMemo, useState } from "react";
import { PublicClient, WalletClient } from "viem";
import { useAccount, useChainId, usePublicClient, useSwitchChain, useWalletClient } from "wagmi";
import { addArcTestnetToInjectedWallet, ARC_TESTNET_ID } from "@/lib/wallet";
import { createSettlementKey, transferArcToken } from "@/lib/arc-payments";
import { addActivityRecord, upsertSettlementPayment } from "@/lib/db";
import { Group, Settlement, SettlementPayment, SettlementToken } from "@/lib/types";
import { getMemberWallet } from "@/lib/members";

interface SettleItem {
  settlement: Settlement;
  settlementKey: string;
  payerWallet: string;
  receiverWallet: string;
}

interface Props {
  group: Group;
  groupId: string;
  items: SettleItem[];
  token: SettlementToken;
  onClose: () => void;
  onComplete: () => void;
  onStatus: (message: string, kind?: "success" | "error") => void;
}

export default function SettleAllModal({ group, groupId, items, token, onClose, onComplete, onStatus }: Props) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId: ARC_TESTNET_ID });
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();

  const [phase, setPhase] = useState<"preview" | "executing" | "done" | "error">("preview");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progressMessages, setProgressMessages] = useState<string[]>([]);
  const [execError, setExecError] = useState("");

  const payerMember = useMemo(() => {
    if (!address) return null;
    return group.members.find(
      (m) => m.walletAddress?.toLowerCase() === address.toLowerCase()
    ) ?? null;
  }, [address, group.members]);

  const totalAmount = useMemo(
    () => items.reduce((sum, item) => sum + item.settlement.amount, 0),
    [items]
  );

  const handleExecute = useCallback(async () => {
    if (!isConnected || !address || !walletClient || !publicClient) {
      onStatus("Connect your wallet before settling.", "error");
      return;
    }

    setPhase("executing");
    setProgressMessages([]);

    const batchId = crypto.randomUUID();
    const messages: string[] = [];

    try {
      await addActivityRecord(groupId, "batch.settlement_initiated",
        `Batch settlement started: ${items.length} payment(s).`,
        { batchId, paymentCount: items.length, token },
        "StableSplit",
        address
      );

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        setCurrentIndex(i);
        messages.push(`Transaction ${i + 1} of ${items.length}: ${item.settlement.from} pays ${item.settlement.to} ${token} ${item.settlement.amount.toFixed(2)}`);
        setProgressMessages([...messages]);

        if (Number(chainId) !== ARC_TESTNET_ID) {
          try {
            await switchChainAsync({ chainId: ARC_TESTNET_ID });
          } catch {
            await addArcTestnetToInjectedWallet();
            await switchChainAsync({ chainId: ARC_TESTNET_ID });
          }
        }

        await upsertSettlementPayment(groupId, {
          settlementKey: item.settlementKey,
          from: item.settlement.from,
          to: item.settlement.to,
          payerWallet: item.payerWallet,
          receiverWallet: item.receiverWallet,
          amount: item.settlement.amount,
          currency: token,
          batchId,
          status: "pending",
        }, address);

        const result = await transferArcToken({
          publicClient,
          walletClient,
          receiverWallet: item.receiverWallet as `0x${string}`,
          amount: item.settlement.amount,
          token,
        });

        await upsertSettlementPayment(groupId, {
          settlementKey: item.settlementKey,
          from: item.settlement.from,
          to: item.settlement.to,
          payerWallet: result.payerWallet,
          receiverWallet: result.receiverWallet,
          amount: item.settlement.amount,
          currency: token,
          batchId,
          status: "paid",
          txHash: result.txHash,
        }, address);

        messages[messages.length - 1] += " ✓";
        setProgressMessages([...messages]);
      }

      await addActivityRecord(groupId, "batch.settlement_completed",
        `Batch settlement completed: ${items.length} payment(s).`,
        { batchId, paymentCount: items.length, totalAmount, token },
        "StableSplit",
        address
      );

      setPhase("done");
      onStatus(`All ${items.length} payment(s) settled successfully via ${token}.`, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Batch settlement failed.";
      setExecError(message);
      messages.push(`Failed: ${message}`);
      setProgressMessages([...messages]);

      await addActivityRecord(groupId, "batch.settlement_failed",
        `Batch settlement failed after ${currentIndex + 1} of ${items.length} payment(s).`,
        { batchId, completedCount: currentIndex + 1, totalCount: items.length, error: message, token },
        "StableSplit",
        address
      );

      setPhase("error");
      onStatus(message, "error");
    }
  }, [isConnected, address, walletClient, publicClient, chainId, switchChainAsync, groupId, items, token, currentIndex, totalAmount, onStatus]);

  return (
    <>
      <div
        className="animate-backdrop"
        onClick={phase === "preview" ? onClose : undefined}
        style={{
          position: "fixed", inset: 0,
          background: "var(--overlay)",
          backdropFilter: "blur(4px)",
          zIndex: 100,
        }}
      />
      <div
        style={{
          position: "fixed", inset: 0,
          zIndex: 101,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "clamp(0.75rem, 3vw, 2rem)",
          pointerEvents: "none",
        }}
      >
        <div
          className="animate-scale-in"
          style={{
            width: "min(480px, 100%)",
            background: "var(--surface)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-lg)",
            overflow: "hidden",
            pointerEvents: "auto",
          }}
        >
          {/* Header */}
          <div style={{ padding: "1.5rem 1.75rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start" }}>
              <div>
                <h2 style={{ fontWeight: 700, fontSize: "1.125rem", letterSpacing: "-0.02em" }}>
                  {phase === "preview" ? "Settle All Debts" : phase === "executing" ? "Settling..." : phase === "done" ? "Complete" : "Error"}
                </h2>
                <p style={{ color: "var(--text-2)", fontSize: "0.8125rem", marginTop: "0.125rem" }}>
                  {phase === "preview" ? `Review ${items.length} payment(s) before confirming` : ""}
                </p>
              </div>
              {phase === "preview" && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  style={{ width: 32, height: 32, borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-2)", flexShrink: 0, transition: "all 0.15s ease" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-3)"; e.currentTarget.style.color = "var(--text)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface-2)"; e.currentTarget.style.color = "var(--text-2)"; }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              )}
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: "1.25rem 1.75rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {phase === "preview" && (
              <>
                {!isConnected || !payerMember ? (
                  <div style={{ padding: "0.75rem 1rem", background: "var(--red-light)", border: "1px solid var(--error-border)", borderRadius: 8, fontSize: "0.8125rem", color: "var(--red)", fontWeight: 600 }}>
                    Connect and link your wallet to settle debts.
                  </div>
                ) : (
                  <p style={{ fontSize: "0.8125rem", color: "var(--text-2)", marginBottom: "0.25rem" }}>
                    You are settling as <strong style={{ color: "var(--text)" }}>{payerMember.displayName}</strong>.
                  </p>
                )}

                {/* Payment list */}
                {items.map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 0", borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--blue-light)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.75rem", color: "var(--blue)", flexShrink: 0 }}>
                        {item.settlement.to.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: "0.875rem" }}>{item.settlement.to}</p>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>Recipient</p>
                      </div>
                    </div>
                    <div className="mono" style={{ fontWeight: 700, fontSize: "0.9375rem", textAlign: "right" }}>
                      {token} {item.settlement.amount.toFixed(2)}
                    </div>
                  </div>
                ))}

                {/* Total */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "0.75rem", borderTop: "2px solid var(--border)" }}>
                  <span style={{ fontWeight: 700, fontSize: "1rem" }}>Total</span>
                  <span className="mono" style={{ fontWeight: 800, fontSize: "1.125rem", color: "var(--blue)" }}>
                    {token} {totalAmount.toFixed(2)}
                  </span>
                </div>
              </>
            )}

            {(phase === "executing" || phase === "done" || phase === "error") && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                  <div className="spinner" />
                  <div>
                    <p style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                      {phase === "executing" ? `Transaction ${currentIndex + 1} of ${items.length}` : phase === "done" ? "All transactions complete" : "Transaction failed"}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>
                      {phase === "executing" ? "Please confirm each transaction in your wallet." : ""}
                    </p>
                  </div>
                </div>

                {progressMessages.map((msg, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "0.5rem 0.75rem",
                      borderRadius: 6,
                      fontSize: "0.8125rem",
                      background: msg.includes("✓") ? "var(--green-light)" : msg.includes("Failed") ? "var(--red-light)" : "var(--surface-2)",
                      color: msg.includes("✓") ? "var(--green)" : msg.includes("Failed") ? "var(--red)" : "var(--text)",
                      fontWeight: 500,
                      fontFamily: "Space Mono, monospace",
                    }}
                  >
                    {msg}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: "1.25rem 1.75rem", borderTop: "1px solid var(--border)", display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            {phase === "preview" && (
              <>
                <button type="button" onClick={onClose} className="btn-secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecute}
                  className="btn-primary"
                  disabled={!isConnected || !payerMember}
                  style={{ padding: "0.5rem 1rem", fontSize: "0.875rem", opacity: !isConnected || !payerMember ? 0.6 : 1 }}
                >
                  Confirm & Settle All
                </button>
              </>
            )}
            {phase === "done" && (
              <button type="button" onClick={() => { onComplete(); onClose(); }} className="btn-primary" style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}>
                Done
              </button>
            )}
            {phase === "error" && (
              <button type="button" onClick={onClose} className="btn-primary" style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}>
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
