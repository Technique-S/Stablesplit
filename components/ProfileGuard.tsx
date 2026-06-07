"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { getProfileId } from "@/lib/local-profile";
import { getProfile } from "@/lib/profile";

const ALLOWED_NO_PROFILE_ROUTES = ["/", "/create-profile", "/join/"];

export default function ProfileGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const [checking, setChecking] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!isConnected || !address) {
        if (!cancelled) {
          setHasProfile(false);
          setChecking(false);
        }
        return;
      }

      const pid = getProfileId(address);
      if (!pid) {
        if (!cancelled) {
          setHasProfile(false);
          setChecking(false);
        }
        return;
      }

      const profile = await getProfile(pid);
      if (!cancelled) {
        setHasProfile(!!profile);
        setChecking(false);
      }
    }

    void check();
    return () => { cancelled = true; };
  }, [address, isConnected]);

  useEffect(() => {
    if (checking) return;
    if (hasProfile) return;
    if (!isConnected || !address) return;

    const isAllowed = ALLOWED_NO_PROFILE_ROUTES.some((route) =>
      pathname === route || pathname.startsWith(route)
    );

    if (!isAllowed) {
      router.replace("/create-profile");
    }
  }, [checking, hasProfile, isConnected, address, pathname, router]);

  if (checking) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  return <>{children}</>;
}