"use client";

import { useMemo, useState } from "react";
import { useAccount, useChainId, usePublicClient, useSwitchChain, useWalletClient } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import Link from "next/link";
import { ARC_TESTNET_EXPLORER_URL, ARC_TESTNET_ID, addArcTestnetToInjectedWallet, arcTestnet } from "@/lib/web3/wallet";
import { ARC_TOKEN_CONTRACTS, ARC_TOKEN_DECIMALS, createSettlementKey, transferArcToken, validateEvmAddress } from "@/lib/web3/arc-payments";
import { upsertSettlementPayment } from "@/lib/client/db";
import { Group, Settlement, SettlementPayment, SettlementToken } from "@/lib/types";
import { getMemberWallet } from "@/lib/domain/members";
import { useWalletReady } from "../wallet/WalletProvider";

interface Props {
  group: Group;
  groupId: string;
  settlement: Settlement;
  payment?: SettlementPayment;
  token: SettlementToken;
  onStatus: (message: string, kind?: "success" | "error") => void;
  onPaid: () => void;
}

export default function SettlementPaymentButton(props: Props) {
  const walletReady = useWalletReady();

  if (!walletReady) {
    return (
      <button type="button" className="btn-secondary" disabled style={{ padding: "0.5rem 0.75rem", fontSize: "0.8125rem" }}>
        Wallet unavailable
      </button>
    );
  }

  return <SettlementPaymentInner {...props} />;
}

function SettlementPaymentInner({ group, groupId, settlement, payment, token, onStatus, onPaid }: Props) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId: ARC_TESTNET_ID });
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  const [paying, setPaying] = useState(false);
  const [insufficient, setInsufficient] = useState<{ balance: string; needed: string } | null>(null);

  const settlementKey = useMemo(() => createSettlementKey(settlement, token), [settlement, token]);
  const payerWallet = getMemberWallet(group.members, settlement.from) || group.memberWallets?.[settlement.from]?.trim() || "";
  const receiverWallet = getMemberWallet(group.members, settlement.to) || group.memberWallets?.[settlement.to]?.trim() || "";
  const paid = payment?.status === "paid" || payment?.settlementStatus === "paid";
  const pending = paying || payment?.status === "pending";
  const missingWallet = !payerWallet || !receiverWallet;

  const handlePayment = async () => {
    if (paid || pending) return;
    if (!isConnected || !address || !walletClient || !publicClient) {
      onStatus("Connect your wallet before paying.", "error");
      return;
    }
    if (!payerWallet || !validateEvmAddress(payerWallet)) {
      onStatus(`Add a valid wallet address for ${settlement.from}.`, "error");
      return;
    }
    if (!receiverWallet || !validateEvmAddress(receiverWallet)) {
      onStatus(`Add a valid wallet address for ${settlement.to}.`, "error");
      return;
    }
    if (address.toLowerCase() !== payerWallet.toLowerCase()) {
      onStatus(`Connected wallet must match ${settlement.from}'s saved wallet.`, "error");
      return;
    }
    if (payerWallet.toLowerCase() === receiverWallet.toLowerCase()) {
      onStatus("Sender and receiver wallets cannot be the same.", "error");
      return;
    }

    setInsufficient(null);

    const tokenAddress = ARC_TOKEN_CONTRACTS[token];
    const decimals = ARC_TOKEN_DECIMALS[token];
    const amountUnits = parseUnits(settlement.amount.toFixed(decimals), decimals);
    const balance = await publicClient.readContract({
      address: tokenAddress,
      abi: [
        {
          type: "function",
          name: "balanceOf",
          stateMutability: "view",
          inputs: [{ name: "account", type: "address" }],
          outputs: [{ name: "balance", type: "uint256" }],
        },
      ] as const,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    });
    if (balance < amountUnits) {
      const displayed = formatUnits(balance, decimals);
      setInsufficient({
        balance: `${displayed} ${token}`,
        needed: `${settlement.amount.toFixed(2)} ${token}`,
      });
      onStatus(`Insufficient ${token} balance. ${displayed} available, ${settlement.amount.toFixed(2)} needed.`, "error");
      return;
    }

    setPaying(true);
    onStatus("Payment pending in wallet...", "success");
    let pendingRecorded = false;

    try {
      if (Number(chainId) !== ARC_TESTNET_ID) {
        try {
          await switchChainAsync({ chainId: ARC_TESTNET_ID });
        } catch (switchError) {
          await addArcTestnetToInjectedWallet();
          await switchChainAsync({ chainId: ARC_TESTNET_ID });
        }
      }

      await upsertSettlementPayment(groupId, {
        settlementKey,
        from: settlement.from,
        to: settlement.to,
        payerWallet,
        receiverWallet,
        amount: settlement.amount,
        currency: token,
        status: "pending",
      }, address);
      pendingRecorded = true;

      const result = await transferArcToken({
        publicClient,
        walletClient,
        receiverWallet: receiverWallet as `0x${string}`,
        amount: settlement.amount,
        token,
      });

      await upsertSettlementPayment(groupId, {
        settlementKey,
        from: settlement.from,
        to: settlement.to,
        payerWallet: result.payerWallet,
        receiverWallet: result.receiverWallet,
        amount: settlement.amount,
        currency: token,
        status: "paid",
        txHash: result.txHash,
      }, address);

      onStatus(`Settlement paid successfully via ${token}.`, "success");
      onPaid();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Payment failed or was rejected.";
      if (pendingRecorded) {
        await upsertSettlementPayment(groupId, {
          settlementKey,
          from: settlement.from,
          to: settlement.to,
          payerWallet,
          receiverWallet,
          amount: settlement.amount,
          currency: token,
          status: "failed",
        }, address);
      }
      onStatus(message, "error");
    } finally {
      setPaying(false);
    }
  };

  if (paid) {
    return (
      <a
        className="btn-secondary"
        href={payment?.txHash ? `${ARC_TESTNET_EXPLORER_URL}/tx/${payment.txHash}` : ARC_TESTNET_EXPLORER_URL}
        target="_blank"
        rel="noreferrer"
        style={{ padding: "0.5rem 0.75rem", fontSize: "0.8125rem", color: "var(--green)", textDecoration: "none" }}
      >
        Paid {payment?.settlementTokenUsed ?? payment?.currency ?? token} {settlement.amount.toFixed(2)} ↗
      </a>
    );
  }

  if (insufficient) {
    const bridgeAmount = settlement.amount.toFixed(2);
    const returnUrl = `/group/${groupId}`;
    return (
      <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
        <button
          type="button"
          className="btn-primary"
          onClick={() => { setInsufficient(null); handlePayment(); }}
          style={{ padding: "0.5rem 0.75rem", fontSize: "0.8125rem", opacity: 0.7 }}
        >
          Retry
        </button>
        <Link
          href={`/bridge?amount=${bridgeAmount}&returnTo=${encodeURIComponent(returnUrl)}`}
          className="btn-secondary"
          style={{ padding: "0.5rem 0.75rem", fontSize: "0.8125rem", textDecoration: "none" }}
        >
          Bridge Funds
        </Link>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="btn-primary"
      onClick={handlePayment}
      disabled={pending || missingWallet}
      title={missingWallet ? "Both members need linked wallets before payment." : undefined}
      style={{ padding: "0.5rem 0.75rem", fontSize: "0.8125rem", opacity: pending || missingWallet ? 0.7 : 1 }}
    >
      {missingWallet ? "Wallet Required" : pending ? "Pending..." : `Pay ${token} ${settlement.amount.toFixed(2)}`}
    </button>
  );
}
