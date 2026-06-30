"use client";

import { defineChain } from "viem";

export const arbitrumSepolia = defineChain({
  id: 421614,
  name: "Arbitrum Sepolia",
  nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://sepolia-rollup.arbitrum.io/rpc"] } },
  blockExplorers: { default: { name: "Arbiscan", url: "https://sepolia.arbiscan.io" } },
  testnet: true,
});

export const avalancheFuji = defineChain({
  id: 43113,
  name: "Avalanche Fuji",
  nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
  rpcUrls: { default: { http: ["https://api.avax-test.network/ext/bc/C/rpc"] } },
  blockExplorers: { default: { name: "Snowtrace", url: "https://subnets-test.avax.network/c-chain" } },
  testnet: true,
});

export const baseSepolia = defineChain({
  id: 84532,
  name: "Base Sepolia",
  nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://sepolia.base.org"] } },
  blockExplorers: { default: { name: "Basescan", url: "https://sepolia.basescan.org" } },
  testnet: true,
});

export const codexTestnet = defineChain({
  id: 812242,
  name: "Codex Testnet",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.codex-stg.xyz"] } },
  blockExplorers: { default: { name: "Codex Explorer", url: "https://explorer.codex-stg.xyz" } },
  testnet: true,
});

export const ethereumSepolia = defineChain({
  id: 11155111,
  name: "Ethereum Sepolia",
  nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://ethereum-sepolia-rpc.publicnode.com"] } },
  blockExplorers: { default: { name: "Etherscan", url: "https://sepolia.etherscan.io" } },
  testnet: true,
});

export const hyperEvmTestnet = defineChain({
  id: 998,
  name: "HyperEVM Testnet",
  nativeCurrency: { name: "Hype", symbol: "HYPE", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.hyperliquid-testnet.xyz/evm"] } },
  blockExplorers: { default: { name: "HyperEVM Explorer", url: "https://app.hyperliquid-testnet.xyz/explorer" } },
  testnet: true,
});

export const inkTestnet = defineChain({
  id: 763373,
  name: "Ink Sepolia",
  nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc-gel-sepolia.inkonchain.com"] } },
  blockExplorers: { default: { name: "Ink Explorer", url: "https://explorer-sepolia.inkonchain.com" } },
  testnet: true,
});

export const lineaSepolia = defineChain({
  id: 59141,
  name: "Linea Sepolia",
  nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.sepolia.linea.build"] } },
  blockExplorers: { default: { name: "Lineascan", url: "https://sepolia.lineascan.build" } },
  testnet: true,
});

export const optimismSepolia = defineChain({
  id: 11155420,
  name: "Optimism Sepolia",
  nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://sepolia.optimism.io"] } },
  blockExplorers: { default: { name: "Optimistic Etherscan", url: "https://sepolia-optimistic.etherscan.io" } },
  testnet: true,
});

export const plumeTestnet = defineChain({
  id: 98867,
  name: "Plume Testnet",
  nativeCurrency: { name: "Plume", symbol: "PLUME", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.plume.org"] } },
  blockExplorers: { default: { name: "Plume Explorer", url: "https://testnet-explorer.plume.org" } },
  testnet: true,
});

export const polygonAmoy = defineChain({
  id: 80002,
  name: "Polygon Amoy",
  nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc-amoy.polygon.technology"] } },
  blockExplorers: { default: { name: "Polygonscan", url: "https://amoy.polygonscan.com" } },
  testnet: true,
});

export const seiTestnet = defineChain({
  id: 1328,
  name: "Sei Testnet",
  nativeCurrency: { name: "Sei", symbol: "SEI", decimals: 18 },
  rpcUrls: { default: { http: ["https://evm-rpc-testnet.sei-apis.com"] } },
  blockExplorers: { default: { name: "Seiscan", url: "https://testnet.seiscan.io" } },
  testnet: true,
});

export const sonicTestnet = defineChain({
  id: 14601,
  name: "Sonic Testnet",
  nativeCurrency: { name: "Sonic", symbol: "S", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.soniclabs.com"] } },
  blockExplorers: { default: { name: "Sonicscan", url: "https://testnet.sonicscan.org" } },
  testnet: true,
});

export const unichainSepolia = defineChain({
  id: 1301,
  name: "Unichain Sepolia",
  nativeCurrency: { name: "Sepolia Uni", symbol: "UNI", decimals: 18 },
  rpcUrls: { default: { http: ["https://sepolia.unichain.org"] } },
  blockExplorers: { default: { name: "Unichain Explorer", url: "https://unichain-sepolia.blockscout.com" } },
  testnet: true,
});

export const worldChainSepolia = defineChain({
  id: 4801,
  name: "World Chain Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://worldchain-sepolia.drpc.org"] } },
  blockExplorers: { default: { name: "Worldscan", url: "https://sepolia.worldscan.org" } },
  testnet: true,
});

export const xdcApothem = defineChain({
  id: 51,
  name: "Apothem Network",
  nativeCurrency: { name: "TXDC", symbol: "TXDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://erpc.apothem.network"] } },
  blockExplorers: { default: { name: "XDCScan", url: "https://testnet.xdcscan.com" } },
  testnet: true,
});

export const bridgeChains = [
  arbitrumSepolia,
  avalancheFuji,
  baseSepolia,
  codexTestnet,
  ethereumSepolia,
  hyperEvmTestnet,
  inkTestnet,
  lineaSepolia,
  optimismSepolia,
  plumeTestnet,
  polygonAmoy,
  seiTestnet,
  sonicTestnet,
  unichainSepolia,
  worldChainSepolia,
  xdcApothem,
];


