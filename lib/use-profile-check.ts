"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { getProfileId } from "./client/local-profile";
import { getProfile, getProfileByWalletAddress } from "./client/profile";
import { UserProfile } from "./types";

type ProfileStatus = "loading" | "no-wallet" | "no-profile" | "has-profile";

interface ProfileCheckResult {
  status: ProfileStatus;
  profile: UserProfile | null;
  profileId: string | null;
  checking: boolean;
  recheck: () => void;
}

function logProfileCheck(
  address: string | undefined,
  profileId: string | null,
  status: ProfileStatus,
  profile: UserProfile | null,
) {
  if (typeof window === "undefined") return;
  const entry = {
    event: "profile.existence_check",
    walletAddress: address?.toLowerCase() ?? null,
    profileId,
    status,
    hasProfile: !!profile,
    timestamp: new Date().toISOString(),
  };
  console.info("[ProfileGuard]", JSON.stringify(entry));
}

export function useProfileCheck(): ProfileCheckResult {
  const { address, isConnected } = useAccount();
  const [status, setStatus] = useState<ProfileStatus>("loading");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const checkRef = useRef(0);

  const check = useCallback(() => {
    const currentCheck = ++checkRef.current;

    if (!isConnected || !address) {
      const reason = !isConnected ? "not_connected" : "no_address";
      setStatus("no-wallet");
      setProfile(null);
      setProfileId(null);
      setChecking(false);
      logProfileCheck(address, null, "no-wallet", null);
      console.info("[ProfileGuard] Early return: " + reason);
      return;
    }

    console.info("[ProfileGuard] Checking profile for", address.toLowerCase());

    const cachedPid = getProfileId(address);
    if (cachedPid) {
      console.info("[ProfileGuard] Cache hit: profileId=" + cachedPid);
      setProfileId(cachedPid);
      setChecking(true);

      getProfile(cachedPid, address)
        .then((p) => {
          if (currentCheck !== checkRef.current) return;
          console.info("[ProfileGuard] getProfile result:", p ? "found" : "not_found");
          if (p) {
            setStatus("has-profile");
            setProfile(p);
          } else {
            setStatus("no-profile");
            setProfile(null);
            setProfileId(null);
          }
          setChecking(false);
          logProfileCheck(address, cachedPid, p ? "has-profile" : "no-profile", p);
        })
        .catch((err) => {
          if (currentCheck !== checkRef.current) return;
          console.warn("[ProfileGuard] getProfile error:", err);
          setStatus("no-profile");
          setProfile(null);
          setProfileId(null);
          setChecking(false);
          logProfileCheck(address, cachedPid, "no-profile", null);
        });
      return;
    }

    console.info("[ProfileGuard] Cache miss, querying walletLinks for", address.toLowerCase());
    setChecking(true);

    getProfileByWalletAddress(address)
      .then((p) => {
        if (currentCheck !== checkRef.current) return;
        console.info("[ProfileGuard] getProfileByWalletAddress result:", p ? "found profileId=" + p.id : "not_found");
        if (p) {
          setStatus("has-profile");
          setProfile(p);
          setProfileId(p.id);
        } else {
          setStatus("no-profile");
          setProfile(null);
          setProfileId(null);
        }
        setChecking(false);
        logProfileCheck(address, p?.id ?? null, p ? "has-profile" : "no-profile", p);
      })
      .catch((err) => {
        if (currentCheck !== checkRef.current) return;
        console.warn("[ProfileGuard] getProfileByWalletAddress error:", err);
        setStatus("no-profile");
        setProfile(null);
        setProfileId(null);
        setChecking(false);
        logProfileCheck(address, null, "no-profile", null);
      });
  }, [address, isConnected]);

  useEffect(() => {
    check();
  }, [check]);

  return { status, profile, profileId, checking, recheck: check };
}
