import { Address, formatUnits, parseUnits, PublicClient, WalletClient } from "viem";
import { Settlement, SettlementToken } from "./types";
import { validateEvmAddress } from "./members";

export { validateEvmAddress };

export const ARC_TOKEN_CONTRACTS: Record<SettlementToken, Address> = {
  USDC: "0x3600000000000000000000000000000000000000",
  EUR: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
};

export const ARC_TOKEN_DECIMALS: Record<SettlementToken, number> = {
  USDC: 6,
  EUR: 6,
};

const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "success", type: "bool" }],
  },
] as const;

export function createSettlementKey(settlement: Settlement, _token?: SettlementToken): string {
  return encodeURIComponent(
    `${settlement.from}__${settlement.to}__${settlement.amount.toFixed(2)}`
  );
}

interface TransferParams {
  publicClient: PublicClient;
  walletClient: WalletClient;
  receiverWallet: Address;
  amount: number;
  token: SettlementToken;
}

export async function transferArcToken({
  publicClient,
  walletClient,
  receiverWallet,
  amount,
  token,
}: TransferParams): Promise<{ txHash: Address; payerWallet: Address; receiverWallet: Address }> {
  const payerWallet = walletClient.account?.address;
  if (!payerWallet) {
    throw new Error("Connect a wallet before paying.");
  }

  if (payerWallet.toLowerCase() === receiverWallet.toLowerCase()) {
    throw new Error("Sender and receiver wallets cannot be the same.");
  }

  const tokenAddress = ARC_TOKEN_CONTRACTS[token];
  const decimals = ARC_TOKEN_DECIMALS[token];
  const amountUnits = parseUnits(amount.toFixed(decimals), decimals);

  const balance = await publicClient.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [payerWallet],
  });

  if (balance < amountUnits) {
    throw new Error(
      `Insufficient ${token}. Balance: ${formatUnits(balance, decimals)} ${token}.`
    );
  }

  // Payment flow: ask wallet to sign an ERC20 transfer, then wait for Arc to
  // confirm the transaction before the UI marks the settlement as paid.
  const txHash = await walletClient.writeContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [receiverWallet, amountUnits],
    account: payerWallet,
    chain: walletClient.chain,
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });

  return {
    txHash,
    payerWallet,
    receiverWallet,
  };
}
