"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BridgeChain, type BridgeResult, type EstimateResult } from "@circle-fin/app-kit";
import { TESTNET_BRIDGE_CHAINS, createAdapter, estimateBridge, executeBridge, retryBridge } from "@/lib/web3/bridge-kit";

type Step = "form" | "quoting" | "confirm" | "bridging" | "done" | "error" | "retrying";

export default function BridgePage() {
  const { address, isConnected } = useAccount();
  const searchParams = useSearchParams();
  const { switchChainAsync } = useSwitchChain();

  const prefillAmount = searchParams.get("amount") || "";
  const returnTo = searchParams.get("returnTo") || "";

  const [fromChain, setFromChain] = useState<BridgeChain>(BridgeChain.Arc_Testnet);
  const [toChain, setToChain] = useState<BridgeChain>(BridgeChain.Base_Sepolia);
  const [amount, setAmount] = useState(prefillAmount);
  const [step, setStep] = useState<Step>("form");
  const [statusMessage, setStatusMessage] = useState("");
  const [estimatedReceive, setEstimatedReceive] = useState<string | null>(null);
  const [gasFees, setGasFees] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const failedResultRef = useRef<BridgeResult | null>(null);
  const lastAdapterRef = useRef<any>(null);

  const availableChains = TESTNET_BRIDGE_CHAINS.filter(
    (c) => c.value !== fromChain
  );

  useEffect(() => {
    setToChain(
      TESTNET_BRIDGE_CHAINS.find((c) => c.value !== fromChain)?.value ?? BridgeChain.Base_Sepolia
    );
    setEstimatedReceive(null);
    setGasFees(null);
    setQuoteError(null);
  }, [fromChain]);

  const fetchQuote = useCallback(async () => {
    if (!amount || Number(amount) <= 0 || !address) return;
    setStep("quoting");
    setQuoteError(null);
    try {
      const adapter = await createAdapter();
      const estimate = await estimateBridge({
        from: { adapter, chain: fromChain },
        to: { adapter, chain: toChain },
        amount,
        token: "USDC",
      });
      setEstimatedReceive(estimate.amount);
      const totalGas = estimate.gasFees
        .filter((g) => g.fees)
        .reduce((sum, g) => sum + Number(g.fees!.fee || 0), 0)
        .toFixed(6);
      const gasToken = estimate.gasFees.find((g) => g.fees)?.token || "";
      setGasFees(`${totalGas} ${gasToken}`);
      setStep("form");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to get quote";
      setQuoteError(message);
      setStep("form");
    }
  }, [amount, fromChain, toChain, address]);

  useEffect(() => {
    if (!amount || Number(amount) <= 0) return;
    const timer = setTimeout(fetchQuote, 500);
    return () => clearTimeout(timer);
  }, [amount, fromChain, toChain, fetchQuote]);

  const handleBridge = async () => {
    if (!address || !amount || Number(amount) <= 0) return;
    setStep("bridging");
    setStatusMessage("Preparing bridge transaction...");
    try {
      const adapter = await createAdapter();
      setStatusMessage("Waiting for wallet confirmation...");
      const result = await executeBridge({
        from: { adapter, chain: fromChain },
        to: { adapter, chain: toChain },
        amount,
        token: "USDC",
      });
      if (result.state === "success") {
        setStep("done");
        setStatusMessage(`Bridge complete! Transferred ${result.amount} USDC.`);
      } else {
        const burnStep = result.steps?.find((s) => s.name === "burn" && s.state === "success");
        const failedStep = result.steps?.find((s) => s.name === "fetchAttestation" && s.state === "error");
        if (burnStep) {
          const errorDetail = failedStep?.errorMessage ? ` (${failedStep.errorMessage})` : "";
          const explorerLink = burnStep.explorerUrl ? `\nView burn tx: ${burnStep.explorerUrl}` : "";
          failedResultRef.current = result;
          lastAdapterRef.current = adapter;
          setStatusMessage(`Burn completed on-chain${explorerLink}. Attestation fetch failed${errorDetail}. Your funds are bridged — you can retry to complete the mint.`);
        } else {
          setStatusMessage(`Bridge failed: ${result.state}`);
        }
        setStep("error");
      }
    } catch (err) {
      failedResultRef.current = null;
      lastAdapterRef.current = null;
      const message = err instanceof Error ? err.message : "Bridge failed or was rejected.";
      setStep("error");
      setStatusMessage(message);
    }
  };

  const handleRetry = async () => {
    const result = failedResultRef.current;
    const adapter = lastAdapterRef.current;
    if (!result || !adapter) {
      setStatusMessage("No failed bridge to retry. Start a new bridge.");
      setStep("error");
      return;
    }
    setStep("retrying");
    setStatusMessage("Retrying bridge from last step...");
    try {
      const retryResult = await retryBridge(result, { from: adapter, to: adapter });
      if (retryResult.state === "success") {
        failedResultRef.current = null;
        lastAdapterRef.current = null;
        setStep("done");
        setStatusMessage(`Bridge complete! Transferred ${retryResult.amount} USDC.`);
      } else {
        const failedStep = retryResult.steps?.find((s) => s.state === "error");
        setStatusMessage(`Retry failed: ${failedStep?.errorMessage || retryResult.state}`);
        setStep("error");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Retry failed or was rejected.";
      setStatusMessage(message);
      setStep("error");
    }
  };

  const resetForm = () => {
    setAmount("");
    setEstimatedReceive(null);
    setGasFees(null);
    setQuoteError(null);
    setStatusMessage("");
    setStep("form");
  };

  const containerStyle: React.CSSProperties = {
    maxWidth: 600,
    margin: "0 auto",
    padding: "2rem 1.5rem",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "0.8125rem",
    fontWeight: 600,
    color: "var(--text-2)",
    marginBottom: "0.375rem",
    display: "block",
  };

  const selectStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.625rem 0.75rem",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--surface-2)",
    color: "var(--text)",
    fontSize: "0.875rem",
    fontFamily: "DM Sans, sans-serif",
    outline: "none",
    marginBottom: "1rem",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.625rem 0.75rem",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--surface-2)",
    color: "var(--text)",
    fontSize: "1rem",
    fontFamily: "DM Sans, sans-serif",
    outline: "none",
    marginBottom: "1rem",
  };

  if (!isConnected || !address) {
    return (
      <div style={containerStyle}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>Bridge USDC</h1>
        <p style={{ color: "var(--text-2)", fontSize: "0.875rem" }}>
          Connect your wallet to bridge USDC between chains via CCTP.
        </p>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>Bridge USDC</h1>
          <p style={{ color: "var(--text-2)", fontSize: "0.8125rem", margin: "0.25rem 0 0 0" }}>
            Cross-chain transfer via Circle CCTP
          </p>
        </div>
        {returnTo && (
          <Link
            href={returnTo}
            style={{ fontSize: "0.8125rem", color: "var(--blue)", textDecoration: "none" }}
          >
            &larr; Back
          </Link>
        )}
      </div>

      {step === "done" ? (
        <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem", color: "var(--green)" }}>&#10003;</div>
          <p style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.5rem" }}>Bridge Complete</p>
          <p style={{ color: "var(--text-2)", fontSize: "0.875rem", marginBottom: "1.5rem" }}>{statusMessage}</p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
            <button type="button" className="btn-primary" onClick={resetForm}>
              Bridge Again
            </button>
            {returnTo && (
              <Link href={returnTo} className="btn-secondary" style={{ textDecoration: "none" }}>
                Return to Group
              </Link>
            )}
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "0.75rem", alignItems: "end", marginBottom: "0.5rem" }}>
            <div>
              <label style={labelStyle}>From Chain</label>
              <select
                value={fromChain}
                onChange={(e) => setFromChain(e.target.value as BridgeChain)}
                style={selectStyle}
                disabled={step === "bridging" || step === "retrying"}
              >
                {TESTNET_BRIDGE_CHAINS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div style={{ paddingBottom: "1rem", fontSize: "1.25rem", color: "var(--text-2)" }}>&rarr;</div>
            <div>
              <label style={labelStyle}>To Chain</label>
              <select
                value={toChain}
                onChange={(e) => setToChain(e.target.value as BridgeChain)}
                style={selectStyle}
                disabled={step === "bridging" || step === "retrying"}
              >
                {availableChains.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Amount (USDC)</label>
            <div style={{ position: "relative" }}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                style={inputStyle}
                disabled={step === "bridging" || step === "retrying"}
              />
              <span style={{ position: "absolute", right: "0.75rem", top: "0.625rem", fontSize: "0.8125rem", color: "var(--text-2)", pointerEvents: "none" }}>
                USDC
              </span>
            </div>
          </div>

          {step === "retrying" && (
            <div style={{ padding: "1rem", background: "var(--blue-light)", borderRadius: 8, marginBottom: "1rem", fontSize: "0.875rem", fontWeight: 500 }}>
              {statusMessage}
            </div>
          )}

          {step === "quoting" && (
            <div style={{ padding: "1rem", background: "var(--surface-2)", borderRadius: 8, marginBottom: "1rem", fontSize: "0.875rem", color: "var(--text-2)" }}>
              Fetching quote...
            </div>
          )}

          {quoteError && (
            <div style={{ padding: "0.75rem 1rem", background: "var(--red-light, #fef2f2)", borderRadius: 8, marginBottom: "1rem", fontSize: "0.8125rem", color: "var(--red, #dc2626)" }}>
              {quoteError}
            </div>
          )}

          {estimatedReceive && (
            <div style={{ padding: "1rem", background: "var(--surface-2)", borderRadius: 8, marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", marginBottom: "0.375rem" }}>
                <span style={{ color: "var(--text-2)" }}>Estimated Receive</span>
                <span style={{ fontWeight: 600 }}>{Number(estimatedReceive).toFixed(6)} USDC</span>
              </div>
              {gasFees && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem" }}>
                  <span style={{ color: "var(--text-2)" }}>Network Fee</span>
                  <span style={{ color: "var(--text-2)" }}>{gasFees}</span>
                </div>
              )}
            </div>
          )}

          {step === "bridging" && (
            <div style={{ padding: "1rem", background: "var(--blue-light)", borderRadius: 8, marginBottom: "1rem", fontSize: "0.875rem", fontWeight: 500 }}>
              {statusMessage}
            </div>
          )}

          {step === "error" && (
            <div style={{ padding: "0.75rem 1rem", background: "var(--red-light, #fef2f2)", borderRadius: 8, marginBottom: "1rem" }}>
              <p style={{ fontSize: "0.8125rem", color: "var(--red, #dc2626)", margin: "0 0 0.5rem 0", whiteSpace: "pre-wrap" }}>{statusMessage}</p>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {failedResultRef.current && (
                  <button type="button" className="btn-primary" onClick={handleRetry} style={{ fontSize: "0.8125rem" }}>
                    Retry
                  </button>
                )}
                <button type="button" className="btn-secondary" onClick={() => { failedResultRef.current = null; lastAdapterRef.current = null; resetForm(); }} style={{ fontSize: "0.8125rem" }}>
                  Start Over
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            className="btn-primary"
            onClick={handleBridge}
            disabled={
              step === "bridging" ||
              step === "quoting" ||
              step === "retrying" ||
              !amount ||
              Number(amount) <= 0 ||
              fromChain === toChain
            }
            style={{
              width: "100%",
              padding: "0.75rem",
              fontSize: "1rem",
              opacity: step === "bridging" || step === "quoting" || step === "retrying" || !amount || Number(amount) <= 0 || fromChain === toChain ? 0.6 : 1,
            }}
          >
            {step === "bridging" ? "Bridging..." : step === "quoting" ? "Getting Quote..." : step === "retrying" ? "Retrying..." : `Bridge ${amount || "0"} USDC`}
          </button>
        </>
      )}
    </div>
  );
}
