"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { getGroupByInviteCode, joinGroupByInvite } from "@/lib/client/db";
import { Group } from "@/lib/types";
import { useWalletReady } from "@/components/wallet/WalletProvider";
import { useProfileCheck } from "@/lib/use-profile-check";
import { setProfileId } from "@/lib/client/local-profile";
import { upsertProfile, addJoinedGroupId } from "@/lib/client/profile";
import { shortenAddress } from "@/lib/domain/members";

export default function JoinPage() {
  const { inviteCode } = useParams() as { inviteCode: string };
  const router = useRouter();
  const walletReady = useWalletReady();
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { status: profileStatus, checking: profileChecking, profile } = useProfileCheck();

  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [joinLoading, setJoinLoading] = useState(false);
  const [name, setName] = useState("");
  const [includeUnsettled, setIncludeUnsettled] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getGroupByInviteCode(inviteCode)
      .then((g) => {
        setGroup(g);
        if (!g) setError("Invalid or expired invite link.");
      })
      .catch(() => setError("Failed to load group information."))
      .finally(() => setLoading(false));
  }, [inviteCode]);

  const handleConnectWallet = useCallback(async () => {
    if (!walletReady) return;
    await open({ view: "Connect" });
  }, [open, walletReady]);

  const handleJoin = useCallback(async () => {
    setError("");
    setJoinLoading(true);

    try {
      const walletAddr = address ?? "";
      let resolvedProfileId = "";

      if (profileStatus === "has-profile" && profile) {
        resolvedProfileId = profile.id;
      } else {
        const trimmedName = name.trim();
        if (!trimmedName) { setError("Enter your name."); setJoinLoading(false); return; }
        const result = await upsertProfile({ displayName: trimmedName, walletAddress: walletAddr }, walletAddr);
        resolvedProfileId = result?.id ?? "";
        if (result?.id) {
          setProfileId(result.id);
        }
      }

      const displayName = profileStatus === "has-profile" && profile ? profile.displayName : name.trim();
      const joinResult = await joinGroupByInvite(inviteCode, displayName, walletAddr, includeUnsettled, resolvedProfileId);

      if (resolvedProfileId && joinResult.groupId) {
        await addJoinedGroupId(joinResult.groupId, resolvedProfileId, walletAddr);
      }

      router.push(`/group/${joinResult.groupId}?joined=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join group.");
      setJoinLoading(false);
    }
  }, [name, inviteCode, router, includeUnsettled, address, profileStatus, profile]);

  return (
      <main style={{ maxWidth: 480, margin: "0 auto", padding: "2.5rem 1.5rem 4rem" }}>
        <Link href="/" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.375rem", color: "var(--text-2)", fontSize: "0.875rem", marginBottom: "2rem", fontWeight: 500 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Back to Home
        </Link>

        {loading ? (
          <div className="card" style={{ padding: "2rem" }}>
            <div style={{ height: 20, width: "55%", background: "var(--surface-2)", borderRadius: 6, marginBottom: "0.75rem" }} />
            <div style={{ height: 14, width: "80%", background: "var(--surface-2)", borderRadius: 6 }} />
          </div>
        ) : !group ? (
          <div className="card" style={{ padding: "3rem 2rem", textAlign: "center" }}>
            <div style={{ width: 48, height: 48, margin: "0 auto 0.75rem", borderRadius: 12, background: "var(--red-light)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--red)", fontWeight: 900, fontSize: "1.25rem" }}>!</div>
            <p style={{ fontWeight: 700, marginBottom: "0.25rem" }}>Invite not found</p>
            <p style={{ color: "var(--text-2)", fontSize: "0.875rem", marginBottom: "1.25rem" }}>{error || "This invite link is invalid or has expired."}</p>
            <Link href="/" style={{ textDecoration: "none" }}><button className="btn-primary">Go Home</button></Link>
          </div>
        ) : profileChecking ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "4rem 0" }}>
            <div className="spinner spinner-lg" />
          </div>
        ) : (
          <div className="card animate-fade-in" style={{ padding: "2rem" }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--blue-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", marginBottom: "1rem" }}>
              🔗
            </div>

            <h1 style={{ fontSize: "1.375rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "0.25rem" }}>
              {group.name}
            </h1>
            {group.description && (
              <p style={{ color: "var(--text-2)", fontSize: "0.875rem", marginBottom: "0.75rem" }}>{group.description}</p>
            )}
            <p style={{ color: "var(--text-3)", fontSize: "0.8125rem", marginBottom: "1.5rem" }}>
              {group.members.length} member{group.members.length !== 1 ? "s" : ""} · {group.currency}
            </p>

            {!isConnected ? (
              <div style={{ textAlign: "center" }}>
                <p style={{ color: "var(--text-2)", fontSize: "0.875rem", marginBottom: "1.25rem" }}>
                  Connect your wallet to join this group.
                </p>
                {walletReady && (
                  <button onClick={handleConnectWallet} className="btn-primary" style={{ width: "100%", justifyContent: "center" }}>
                    Connect Wallet
                  </button>
                )}
              </div>
            ) : profileStatus === "has-profile" && profile ? (
              <form
                onSubmit={(e) => { e.preventDefault(); void handleJoin(); }}
                style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1rem", background: "var(--surface-2)", borderRadius: 10, border: "1px solid var(--border)" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--blue-light)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.875rem" }}>
                    {profile.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>{profile.displayName}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>{shortenAddress(address)}</div>
                  </div>
                  <div style={{ fontSize: "0.6875rem", color: "var(--green)", fontWeight: 600, background: "var(--green-light)", padding: "0.25rem 0.5rem", borderRadius: 6 }}>Profile</div>
                </div>

                <label
                  style={{
                    display: "flex", alignItems: "center", gap: "0.625rem",
                    padding: "0.75rem 1rem", borderRadius: 8, cursor: "pointer",
                    background: "var(--surface-2)", border: "1px solid var(--border)",
                    fontSize: "0.8125rem", userSelect: "none",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={includeUnsettled}
                    onChange={(e) => setIncludeUnsettled(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: "var(--blue)", cursor: "pointer", flexShrink: 0 }}
                  />
                  <div>
                    <span style={{ fontWeight: 600, color: "var(--text)" }}>Include me in all unsettled expenses</span>
                    <br />
                    <span style={{ color: "var(--text-3)", fontSize: "0.75rem" }}>
                      My share will be added to expenses that haven&apos;t been settled yet.
                    </span>
                  </div>
                </label>

                {error && (
                  <div style={{ padding: "0.75rem 1rem", background: "var(--red-light)", border: "1px solid var(--error-border)", borderRadius: 8, fontSize: "0.8125rem", color: "var(--red)", fontWeight: 600 }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={joinLoading}
                  style={{ justifyContent: "center", width: "100%" }}
                >
                  {joinLoading ? "Joining..." : "Join Group"}
                </button>
              </form>
            ) : (
              <form
                onSubmit={(e) => { e.preventDefault(); void handleJoin(); }}
                style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
              >
                <div>
                  <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text)", marginBottom: "0.375rem" }}>
                    Your Name
                  </label>
                  <input
                    className="input-field"
                    type="text"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                    maxLength={50}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.75rem", background: "var(--surface-2)", borderRadius: 8, fontSize: "0.8125rem", color: "var(--text-3)" }}>
                  <span style={{ fontWeight: 500 }}>Wallet:</span>
                  <span className="mono">{shortenAddress(address)}</span>
                </div>

                <label
                  style={{
                    display: "flex", alignItems: "center", gap: "0.625rem",
                    padding: "0.75rem 1rem", borderRadius: 8, cursor: "pointer",
                    background: "var(--surface-2)", border: "1px solid var(--border)",
                    fontSize: "0.8125rem", userSelect: "none",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={includeUnsettled}
                    onChange={(e) => setIncludeUnsettled(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: "var(--blue)", cursor: "pointer", flexShrink: 0 }}
                  />
                  <div>
                    <span style={{ fontWeight: 600, color: "var(--text)" }}>Include me in all unsettled expenses</span>
                    <br />
                    <span style={{ color: "var(--text-3)", fontSize: "0.75rem" }}>
                      My share will be added to expenses that haven&apos;t been settled yet.
                    </span>
                  </div>
                </label>

                {error && (
                  <div style={{ padding: "0.75rem 1rem", background: "var(--red-light)", border: "1px solid var(--error-border)", borderRadius: 8, fontSize: "0.8125rem", color: "var(--red)", fontWeight: 600 }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={joinLoading || !name.trim()}
                  style={{ justifyContent: "center", width: "100%" }}
                >
                  {joinLoading ? "Creating Profile & Joining..." : "Create Profile & Join"}
                </button>
              </form>
            )}
          </div>
        )}
      </main>
  );
}
