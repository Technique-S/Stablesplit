"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { formatUnits } from "viem";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BridgeChain, type BridgeResult, type EstimateResult } from "@circle-fin/app-kit";
import { TESTNET_BRIDGE_CHAINS, createAdapter, estimateBridge, executeBridge, retryBridge, fetchUsdcBalance, getBridgeChainConfig } from "@/lib/web3/bridge-kit";

type Step = "form" | "quoting" | "confirm" | "bridging" | "done" | "error" | "retrying";

export default function BridgePage() {
  const { address, isConnected, chainId } = useAccount();
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
  const [gasFees, setGasFees] = useState<string[]>([]);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [switchingChain, setSwitchingChain] = useState(false);
  const fromChainConfig = getBridgeChainConfig(fromChain);
  const onWrongChain = !switchingChain && chainId !== undefined && fromChainConfig !== undefined && chainId !== fromChainConfig.chainId;
  const fromChainLabel = TESTNET_BRIDGE_CHAINS.find((c) => c.value === fromChain)?.label ?? fromChain;
  const currentChainLabel = TESTNET_BRIDGE_CHAINS.find((c) => getBridgeChainConfig(c.value)?.chainId === chainId)?.label ?? (chainId ? `Chain #${chainId}` : "Unknown");

  const failedResultRef = useRef<BridgeResult | null>(null);
  const adapterRef = useRef<any>(null);
  const estimatedFeeRef = useRef<string>("0");

  const availableChains = TESTNET_BRIDGE_CHAINS.filter(
    (c) => c.value !== fromChain
  );

  useEffect(() => {
    adapterRef.current = null;
    setToChain(
      TESTNET_BRIDGE_CHAINS.find((c) => c.value !== fromChain)?.value ?? BridgeChain.Base_Sepolia
    );
    setEstimatedReceive(null);
    setGasFees([]);
    setQuoteError(null);
  }, [fromChain]);

  useEffect(() => {
    let cancelled = false;
    setBalanceLoading(true);
    setUsdcBalance(null);
    if (!address) {
      setBalanceLoading(false);
      return;
    }
    fetchUsdcBalance(address as `0x${string}`, fromChain)
      .then((balance) => {
        if (!cancelled) {
          setUsdcBalance(balance);
          setBalanceLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUsdcBalance(null);
          setBalanceLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [address, fromChain]);

  const getCachedAdapter = useCallback(async () => {
    if (!adapterRef.current) {
      adapterRef.current = await createAdapter();
    }
    return adapterRef.current;
  }, []);

  const switchToFromChain = useCallback(async () => {
    if (!fromChainConfig) return;
    setSwitchingChain(true);
    try {
      await switchChainAsync({ chainId: fromChainConfig.chainId });
    } catch {
      setStatusMessage(`Could not switch to ${fromChainLabel}. Try switching manually in your wallet.`);
      setStep("error");
    } finally {
      setSwitchingChain(false);
    }
  }, [fromChainConfig, fromChainLabel, switchChainAsync]);

  const fetchQuote = useCallback(async () => {
    if (!amount || Number(amount) <= 0 || !address) return;
    setStep("quoting");
    setQuoteError(null);
    try {
      const adapter = await getCachedAdapter();
      const estimate = await estimateBridge({
        from: { adapter, chain: fromChain },
        to: { adapter, chain: toChain, useForwarder: true },
        amount,
        token: "USDC",
      });
      setEstimatedReceive(estimate.amount);
      const fee = Math.max(0, Number(amount) - Number(estimate.amount));
      estimatedFeeRef.current = String(fee * 1.1 || "0.5");
      const feeByToken = estimate.gasFees
        .filter((g) => g.fees && g.fees.fee != null)
        .reduce<Map<string, bigint>>((acc, g) => {
          try {
            const feeBigInt = BigInt(g.fees!.fee);
            acc.set(g.token, (acc.get(g.token) || BigInt(0)) + feeBigInt);
          } catch {
            /* skip invalid fee string */
          }
          return acc;
        }, new Map());
      const feeLines = Array.from(feeByToken.entries()).map(([token, total]) => {
        const decimals = token === "USDC" ? 6 : 18;
        return `${Number(formatUnits(total, decimals)).toFixed(6)} ${token}`;
      });
      setGasFees(feeLines);
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
      const adapter = await getCachedAdapter();
      setStatusMessage("Waiting for wallet confirmation...");
      const maxFee = estimatedFeeRef.current;
      const result = await executeBridge({
        from: { adapter, chain: fromChain },
        to: { adapter, chain: toChain, useForwarder: true },
        amount,
        token: "USDC",
        config: { maxFee },
      });
      if (result.state === "success") {
        setStep("done");
        setStatusMessage(`Bridge complete! Transferred ${result.amount} USDC.`);
      } else {
        const burnStep = result.steps?.find((s) => s.name === "burn" && s.state === "success");
        const errorSteps = result.steps?.filter((s) => s.state === "error") || [];
        if (burnStep) {
          const explorerLink = burnStep.explorerUrl ? `\nView burn tx: ${burnStep.explorerUrl}` : "";
          failedResultRef.current = result;
          const failureDetail = errorSteps.length > 0
            ? "\n" + errorSteps.map((s) => `- ${s.name}: ${s.errorMessage || s.state}`).join("\n")
            : "";
          setStatusMessage(
            `Burn completed on-chain${explorerLink}.${failureDetail}\n\nYour funds are bridged — you can retry to complete the mint.`
          );
        } else {
          const failureDetail = errorSteps.length > 0
            ? "\n" + errorSteps.map((s) => `- ${s.name}: ${s.errorMessage || s.state}`).join("\n")
            : "";
          setStatusMessage(`Bridge failed (result: ${result.state}).${failureDetail}`);
        }
        setStep("error");
      }
    } catch (err) {
      failedResultRef.current = null;
      const message = err instanceof Error ? err.message : "Bridge failed or was rejected.";
      setStep("error");
      setStatusMessage(message);
    }
  };

  const handleRetry = async () => {
    const result = failedResultRef.current;
    if (!result) {
      setStatusMessage("No failed bridge to retry. Start a new bridge.");
      setStep("error");
      return;
    }
    setStep("retrying");
    setStatusMessage("Retrying bridge from last step...");
    try {
      const adapter = await getCachedAdapter();
      const retryResult = await retryBridge(result, { from: adapter, to: adapter });
      if (retryResult.state === "success") {
        failedResultRef.current = null;
        setStep("done");
        setStatusMessage(`Bridge complete! Transferred ${retryResult.amount} USDC.`);
      } else {
        const errorSteps = retryResult.steps?.filter((s) => s.state === "error") || [];
        const failureDetail = errorSteps.length > 0
          ? "\n" + errorSteps.map((s) => `- ${s.name}: ${s.errorMessage || s.state}`).join("\n")
          : "";
        setStatusMessage(`Retry failed (${retryResult.state}).${failureDetail}`);
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
    setGasFees([]);
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

          {onWrongChain && (
            <div style={{ padding: "0.75rem 1rem", background: "var(--yellow-light, #fef9c3)", borderRadius: 8, marginBottom: "1rem", fontSize: "0.8125rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                <span>
                  Wallet is on <strong>{currentChainLabel}</strong>. Switch to <strong>{fromChainLabel}</strong> to bridge.
                </span>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={switchToFromChain}
                  disabled={switchingChain}
                  style={{ fontSize: "0.8125rem", padding: "0.375rem 0.75rem", whiteSpace: "nowrap" }}
                >
                  {switchingChain ? "Switching..." : `Switch to ${fromChainLabel}`}
                </button>
              </div>
            </div>
          )}

          <div>
            <label style={labelStyle}>Amount (USDC)</label>
            <div style={{ position: "relative" }}>
              <input
                type="number"
                min="0"
                step="0.000001"
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
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "-0.5rem", marginBottom: "1rem", minHeight: "1.25rem" }}>
              {balanceLoading && (
                <span style={{ fontSize: "0.75rem", color: "var(--text-2)" }}>Checking balance...</span>
              )}
              {!balanceLoading && usdcBalance !== null && (
                <span style={{ fontSize: "0.75rem", color: "var(--text-2)" }}>
                  Balance: <strong>{Number(usdcBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</strong> USDC
                </span>
              )}
              {!balanceLoading && usdcBalance === null && (
                <span style={{ fontSize: "0.75rem", color: "var(--text-2)" }}>Balance: N/A</span>
              )}
            </div>
          </div>

          {usdcBalance !== null && amount && Number(amount) > Number(usdcBalance) && (
            <div style={{ padding: "0.5rem 0.75rem", background: "var(--red-light, #fef2f2)", borderRadius: 8, marginBottom: "1rem", fontSize: "0.8125rem", color: "var(--red, #dc2626)" }}>
              Insufficient USDC balance. Available: {Number(usdcBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} USDC
            </div>
          )}

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
              {gasFees.map((line, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem" }}>
                  <span style={{ color: "var(--text-2)" }}>{i === 0 ? "Network Fee" : ""}</span>
                  <span style={{ color: "var(--text-2)" }}>{line}</span>
                </div>
              ))}
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
                <button type="button" className="btn-secondary" onClick={() => { failedResultRef.current = null; adapterRef.current = null; resetForm(); }} style={{ fontSize: "0.8125rem" }}>
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
              onWrongChain ||
              step === "bridging" ||
              step === "quoting" ||
              step === "retrying" ||
              !amount ||
              Number(amount) <= 0 ||
              fromChain === toChain ||
              (usdcBalance !== null && Number(amount) > Number(usdcBalance))
            }
            style={{
              width: "100%",
              padding: "0.75rem",
              fontSize: "1rem",
              opacity: onWrongChain || step === "bridging" || step === "quoting" || step === "retrying" || !amount || Number(amount) <= 0 || fromChain === toChain || (usdcBalance !== null && Number(amount) > Number(usdcBalance)) ? 0.6 : 1,
            }}
          >
            {step === "bridging" ? "Bridging..." : step === "quoting" ? "Getting Quote..." : step === "retrying" ? "Retrying..." : `Bridge ${amount || "0"} USDC`}
          </button>
        </>
      )}
    </div>
  );
}
