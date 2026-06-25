"use client";

import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { createStorage, http, noopStorage } from "wagmi";
import { defineChain } from "viem";
import { shortenAddress as _shortenAddress, validateEvmAddress } from "../domain/members";

export const ARC_TESTNET_ID = 5042002;
export const ARC_TESTNET_RPC_URL = "https://rpc.testnet.arc.network";
export const ARC_TESTNET_EXPLORER_URL = "https://testnet.arcscan.app";
export const ARC_TESTNET_GAS_TRACKER_URL = "https://testnet.arcscan.app/gas-tracker";
export const ARC_TESTNET_FAUCET_URL = "https://faucet.circle.com";

export const arcTestnet = defineChain({
  id: ARC_TESTNET_ID,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 6,
  },
  rpcUrls: {
    default: {
      http: [ARC_TESTNET_RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: "ArcScan",
      url: ARC_TESTNET_EXPLORER_URL,
    },
  },
  testnet: true,
});

export const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? "";
export const walletEnabled = projectId.length > 0;

const metadata = {
  name: "StableSplit",
  description: "Split expenses and settle up with your group.",
  url: "https://stablesplit.local",
  icons: ["https://avatars.githubusercontent.com/u/179229932"],
};

export const wagmiAdapter = new WagmiAdapter({
  networks: [arcTestnet],
  projectId: projectId || "missing-reown-project-id",
  ssr: true,
  storage: createStorage({
    storage: noopStorage,
  }),
  transports: {
    [arcTestnet.id]: http(ARC_TESTNET_RPC_URL),
  },
});

let appKitInitialized = false;

export function initAppKit() {
  if (typeof window === "undefined") return;
  if (!walletEnabled) return;
  if (appKitInitialized) return;
  appKitInitialized = true;

  createAppKit({
    adapters: [wagmiAdapter],
    networks: [arcTestnet],
    projectId: projectId || "missing-reown-project-id",
    metadata: {
      ...metadata,
      url: window.location.origin,
    },
    themeMode: "light",
    features: {
      analytics: false,
      email: false,
      socials: false,
    },
  });
}

export const wagmiConfig = wagmiAdapter.wagmiConfig;

export function shortAddress(address?: string) {
  return _shortenAddress(address);
}

export function normalizeAddress(address: unknown): string {
  return String(address ?? "").trim().toLowerCase();
}



export async function addArcTestnetToInjectedWallet() {
  if (typeof window === "undefined") return;

  const ethereum = (window as Window & {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }).ethereum;

  if (!ethereum) {
    throw new Error("No injected wallet was found. Install MetaMask or connect with WalletConnect.");
  }

  await ethereum.request({
    method: "wallet_addEthereumChain",
    params: [
      {
        chainId: `0x${ARC_TESTNET_ID.toString(16)}`,
        chainName: "Arc Testnet",
        nativeCurrency: {
          name: "USDC",
          symbol: "USDC",
          decimals: 6,
        },
        rpcUrls: [ARC_TESTNET_RPC_URL],
        blockExplorerUrls: [ARC_TESTNET_EXPLORER_URL],
      },
    ],
  });
}
