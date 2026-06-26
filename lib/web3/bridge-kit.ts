"use client";

import { AppKit, BridgeChain, type BridgeParams, type BridgeResult, type EstimateResult } from "@circle-fin/app-kit";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";

let kitInstance: AppKit | null = null;

export function getKit(): AppKit {
  if (!kitInstance) {
    kitInstance = new AppKit();
  }
  return kitInstance;
}

export async function createAdapter() {
  if (typeof window === "undefined") {
    throw new Error("createAdapter can only be called on the client");
  }
  const ethereum = (window as Window & { ethereum?: unknown }).ethereum;
  if (!ethereum) {
    throw new Error("No injected wallet found. Connect your wallet first.");
  }
  return createViemAdapterFromProvider({ provider: ethereum as any });
}

export async function estimateBridge(params: BridgeParams): Promise<EstimateResult> {
  const kit = getKit();
  return kit.estimateBridge(params);
}

export async function executeBridge(params: BridgeParams): Promise<BridgeResult> {
  const kit = getKit();
  return kit.bridge(params);
}

export async function retryBridge(result: BridgeResult, context: { from: any; to?: any }): Promise<BridgeResult> {
  const kit = getKit();
  return kit.retryBridge(result, context);
}

export const TESTNET_BRIDGE_CHAINS: { label: string; value: BridgeChain }[] = [
  { label: "Arc Testnet", value: BridgeChain.Arc_Testnet },
  { label: "Arbitrum Sepolia", value: BridgeChain.Arbitrum_Sepolia },
  { label: "Avalanche Fuji", value: BridgeChain.Avalanche_Fuji },
  { label: "Base Sepolia", value: BridgeChain.Base_Sepolia },
  { label: "Codex Testnet", value: BridgeChain.Codex_Testnet },
  { label: "EDGE Testnet", value: BridgeChain.Edge_Testnet },
  { label: "Ethereum Sepolia", value: BridgeChain.Ethereum_Sepolia },
  { label: "HyperEVM Testnet", value: BridgeChain.HyperEVM_Testnet },
  { label: "Injective Testnet", value: BridgeChain.Injective_Testnet },
  { label: "Ink Testnet", value: BridgeChain.Ink_Testnet },
  { label: "Linea Sepolia", value: BridgeChain.Linea_Sepolia },
  { label: "Monad Testnet", value: BridgeChain.Monad_Testnet },
  { label: "Morph Testnet", value: BridgeChain.Morph_Testnet },
  { label: "OP Sepolia", value: BridgeChain.Optimism_Sepolia },
  { label: "Pharos Atlantic", value: BridgeChain.Pharos_Testnet },
  { label: "Plume Testnet", value: BridgeChain.Plume_Testnet },
  { label: "Polygon Amoy", value: BridgeChain.Polygon_Amoy_Testnet },
  { label: "Sei Testnet", value: BridgeChain.Sei_Testnet },
  { label: "Solana Devnet", value: BridgeChain.Solana_Devnet },
  { label: "Sonic Testnet", value: BridgeChain.Sonic_Testnet },
  { label: "Unichain Sepolia", value: BridgeChain.Unichain_Sepolia },
  { label: "World Chain Sepolia", value: BridgeChain.World_Chain_Sepolia },
  { label: "XDC Apothem", value: BridgeChain.XDC_Apothem },
];
