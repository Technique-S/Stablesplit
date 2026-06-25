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
  profile: UserProfile | null
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
  console.log("[ProfileGuard]", JSON.stringify(entry));
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
      setStatus("no-wallet");
      setProfile(null);
      setProfileId(null);
      setChecking(false);
      logProfileCheck(address, null, "no-wallet", null);
      return;
    }

    const cachedPid = getProfileId(address);
    if (cachedPid) {
      setProfileId(cachedPid);
      setChecking(true);

      getProfile(cachedPid)
        .then((p) => {
          if (currentCheck !== checkRef.current) return;
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
        .catch(() => {
          if (currentCheck !== checkRef.current) return;
          setStatus("no-profile");
          setProfile(null);
          setProfileId(null);
          setChecking(false);
          logProfileCheck(address, cachedPid, "no-profile", null);
        });
      return;
    }

    setChecking(true);

    getProfileByWalletAddress(address)
      .then((p) => {
        if (currentCheck !== checkRef.current) return;
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
      .catch(() => {
        if (currentCheck !== checkRef.current) return;
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
