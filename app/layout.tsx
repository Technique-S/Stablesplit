import type { Metadata } from "next";
import Script from "next/script";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import WalletProvider from "@/components/wallet/WalletProvider";
import ProfileGuard from "@/components/profile/ProfileGuard";
import Navbar from "@/components/layout/Navbar";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "StableSplit — Split expenses effortlessly",
  description: "Create groups, add shared expenses, and settle up in seconds.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const stored = localStorage.getItem("stablesplit-theme");
                const theme = stored === "light" || stored === "dark"
                  ? stored
                  : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
                document.documentElement.dataset.theme = theme;
                document.documentElement.style.colorScheme = theme;
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <WalletProvider>
            <Navbar />
            <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
              <ProfileGuard>
                <ToastProvider>
                  {children}
                </ToastProvider>
              </ProfileGuard>
            </main>
          </WalletProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
