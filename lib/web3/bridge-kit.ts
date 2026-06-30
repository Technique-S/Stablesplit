"use client";

import { AppKit, BridgeChain, type BridgeParams, type BridgeResult, type EstimateResult } from "@circle-fin/app-kit";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";
import { createPublicClient, erc20Abi, formatUnits, http } from "viem";
import type { Address } from "viem";

let kitInstance: AppKit | null = null;

export function getKit(): AppKit {
  if (!kitInstance) {
    kitInstance = new AppKit();
  }
  return kitInstance;
}

export function resetKit(): void {
  kitInstance = null;
}

async function withKitRetry<T>(fn: (kit: AppKit) => Promise<T>): Promise<T> {
  try {
    return await fn(getKit());
  } catch {
    resetKit();
    return await fn(getKit());
  }
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
  return withKitRetry((kit) => kit.estimateBridge(params));
}

export async function executeBridge(params: BridgeParams): Promise<BridgeResult> {
  return withKitRetry((kit) => kit.bridge(params));
}

export async function retryBridge(result: BridgeResult, context: { from: any; to?: any }): Promise<BridgeResult> {
  return withKitRetry((kit) => kit.retryBridge(result, context));
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

type NativeCurrency = {
  name: string
  symbol: string
  decimals: number
}

type BridgeChainConfig = {
  chainId: number
  chainName: string
  nativeCurrency: NativeCurrency
  rpcUrl: string
  usdcAddress?: Address
}

const BRIDGE_CHAIN_CONFIGS: Record<string, BridgeChainConfig> = {
  [BridgeChain.Arc_Testnet]: { chainId: 5042002, chainName: "Arc Testnet", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 }, rpcUrl: "https://rpc.testnet.arc.network", usdcAddress: "0x3600000000000000000000000000000000000000" },
  [BridgeChain.Arbitrum_Sepolia]: { chainId: 421614, chainName: "Arbitrum Sepolia", nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 }, rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc", usdcAddress: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d" },
  [BridgeChain.Avalanche_Fuji]: { chainId: 43113, chainName: "Avalanche Fuji", nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 }, rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc", usdcAddress: "0x5425890298aed601595a70AB815c96711a31Bc65" },
  [BridgeChain.Base_Sepolia]: { chainId: 84532, chainName: "Base Sepolia", nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 }, rpcUrl: "https://sepolia.base.org", usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" },
  [BridgeChain.Codex_Testnet]: { chainId: 812242, chainName: "Codex Testnet", nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrl: "https://rpc.codex-stg.xyz", usdcAddress: "0x6d7f141b6819C2c9CC2f818e6ad549E7Ca090F8f" },
  [BridgeChain.Ethereum_Sepolia]: { chainId: 11155111, chainName: "Ethereum Sepolia", nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 }, rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com", usdcAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" },
  [BridgeChain.HyperEVM_Testnet]: { chainId: 998, chainName: "HyperEVM Testnet", nativeCurrency: { name: "Hype", symbol: "HYPE", decimals: 18 }, rpcUrl: "https://rpc.hyperliquid-testnet.xyz/evm", usdcAddress: "0x2B3370eE501B4a559b57D449569354196457D8Ab" },
  [BridgeChain.Ink_Testnet]: { chainId: 763373, chainName: "Ink Sepolia", nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 }, rpcUrl: "https://rpc-gel-sepolia.inkonchain.com", usdcAddress: "0xFabab97dCE620294D2B0b0e46C68964e326300Ac" },
  [BridgeChain.Linea_Sepolia]: { chainId: 59141, chainName: "Linea Sepolia", nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 }, rpcUrl: "https://rpc.sepolia.linea.build", usdcAddress: "0xfece4462d57bd51a6a552365a011b95f0e16d9b7" },
  [BridgeChain.Optimism_Sepolia]: { chainId: 11155420, chainName: "Optimism Sepolia", nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 }, rpcUrl: "https://sepolia.optimism.io", usdcAddress: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7" },
  [BridgeChain.Plume_Testnet]: { chainId: 98867, chainName: "Plume Testnet", nativeCurrency: { name: "Plume", symbol: "PLUME", decimals: 18 }, rpcUrl: "https://testnet-rpc.plume.org", usdcAddress: "0xcB5f30e335672893c7eb944B374c196392C19D18" },
  [BridgeChain.Polygon_Amoy_Testnet]: { chainId: 80002, chainName: "Polygon Amoy", nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 }, rpcUrl: "https://rpc-amoy.polygon.technology", usdcAddress: "0x41E94Eb019Cee2aF7474fDf5Fc078Bc3eC1c4e2d" },
  [BridgeChain.Sei_Testnet]: { chainId: 1328, chainName: "Sei Testnet", nativeCurrency: { name: "Sei", symbol: "SEI", decimals: 18 }, rpcUrl: "https://evm-rpc-testnet.sei-apis.com", usdcAddress: "0x4fCF1784B31630811181f670Aea7A7bEF803eaED" },
  [BridgeChain.Sonic_Testnet]: { chainId: 14601, chainName: "Sonic Testnet", nativeCurrency: { name: "Sonic", symbol: "S", decimals: 18 }, rpcUrl: "https://rpc.testnet.soniclabs.com", usdcAddress: "0x0BA304580ee7c9a980CF72e55f5Ed2E9fd30Bc51" },
  [BridgeChain.Unichain_Sepolia]: { chainId: 1301, chainName: "Unichain Sepolia", nativeCurrency: { name: "Sepolia Uni", symbol: "UNI", decimals: 18 }, rpcUrl: "https://sepolia.unichain.org", usdcAddress: "0x31d0220469e10c4E71834a79b1f276d740d3768F" },
  [BridgeChain.World_Chain_Sepolia]: { chainId: 4801, chainName: "World Chain Sepolia", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrl: "https://worldchain-sepolia.drpc.org", usdcAddress: "0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88" },
  [BridgeChain.XDC_Apothem]: { chainId: 51, chainName: "Apothem Network", nativeCurrency: { name: "TXDC", symbol: "TXDC", decimals: 18 }, rpcUrl: "https://erpc.apothem.network", usdcAddress: "0xb5AB69F7bBada22B28e79C8FFAECe55eF1c771D4" },
};

export function getBridgeChainConfig(chain: BridgeChain): BridgeChainConfig | undefined {
  return BRIDGE_CHAIN_CONFIGS[chain];
}

export async function fetchUsdcBalance(address: Address, chain: BridgeChain): Promise<string | null> {
  const config = BRIDGE_CHAIN_CONFIGS[chain];
  if (!config) return null;

  if (!config.usdcAddress) return null;

  try {
    const client = createPublicClient({ transport: http(config.rpcUrl) });
    const balance = await client.readContract({
      address: config.usdcAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
    });
    return formatUnits(balance, 6);
  } catch {
    return null;
  }
}
