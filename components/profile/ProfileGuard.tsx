"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { useProfileCheck } from "@/lib/use-profile-check";

function isAllowedRoute(pathname: string): boolean {
  return (
    pathname === "/create-profile" ||
    pathname.startsWith("/join/")
  );
}

export default function ProfileGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isConnected } = useAccount();
  const { status, checking } = useProfileCheck();

  useEffect(() => {
    if (checking) return;
    if (!isConnected) return;

    if (status === "has-profile") {
      if (pathname === "/create-profile") {
        router.replace("/");
      }
      return;
    }

    if (status !== "no-wallet" && !isAllowedRoute(pathname)) {
      router.replace("/create-profile");
    }
  }, [checking, status, isConnected, pathname, router]);

  if (checking) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  return <>{children}</>;
}