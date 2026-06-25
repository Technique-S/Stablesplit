"use client";

import { createContext, ReactNode, useContext, useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAppKitTheme } from "@reown/appkit/react";
import { WagmiProvider } from "wagmi";
import { useTheme } from "../layout/ThemeProvider";
import { initAppKit, wagmiConfig, walletEnabled } from "@/lib/web3/wallet";

const WalletReadyContext = createContext(false);

interface Props {
  children: ReactNode;
}

export default function WalletProvider({ children }: Props) {
  const [ready, setReady] = useState(false);
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    if (!walletEnabled) {
      setReady(true);
      return;
    }
    initAppKit();
    setReady(true);
  }, []);

  if (!walletEnabled) {
    return <WalletReadyContext.Provider value={false}>{children}</WalletReadyContext.Provider>;
  }

  if (!ready) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ textAlign: "center" }}>
          <div className="spinner spinner-lg" style={{ margin: "0 auto" }} />
          <p style={{ marginTop: "1rem", color: "var(--text-3)", fontSize: "0.875rem" }}>Initializing wallet...</p>
        </div>
      </div>
    );
  }

  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>
        <WalletReadyContext.Provider value={true}>
          <AppKitThemeSync />
          {children}
        </WalletReadyContext.Provider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export function useWalletReady() {
  return useContext(WalletReadyContext);
}

function AppKitThemeSync() {
  const { theme } = useTheme();
  const { setThemeMode, setThemeVariables } = useAppKitTheme();
  const syncedTheme = useRef<string | null>(null);

  useEffect(() => {
    if (syncedTheme.current === theme) return;
    syncedTheme.current = theme;
    setThemeMode(theme);
    setThemeVariables({
      "--w3m-accent": theme === "dark" ? "#60A5FA" : "#2563EB",
      "--w3m-color-mix": theme === "dark" ? "#0B1120" : "#FFFFFF",
      "--w3m-border-radius-master": "8px",
    });
  }, [theme, setThemeMode, setThemeVariables]);

  return null;
}
