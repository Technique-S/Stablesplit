"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import ProfileAvatarUpload from "@/components/ProfileAvatarUpload";
import { getProfileId } from "@/lib/local-profile";
import { getProfile, upsertProfile, uploadProfileAvatar } from "@/lib/profile";
import { useWalletReady } from "@/components/WalletProvider";
import { shortenAddress } from "@/lib/members";

export default function CreateProfilePage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const walletReady = useWalletReady();

  const [displayName, setDisplayName] = useState("");
  const [avatarFile, setAvatarFile] = useState<Blob | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [checkedProfile, setCheckedProfile] = useState(false);
  const [alreadyHasProfile, setAlreadyHasProfile] = useState(false);

  useEffect(() => {
    if (!address || !isConnected) return;
    const pid = getProfileId(address);
    if (!pid) return;
    getProfile(pid).then((p) => {
      if (p) {
        setAlreadyHasProfile(true);
        setDisplayName(p.displayName);
      }
      setCheckedProfile(true);
    }).catch(() => setCheckedProfile(true));
  }, [address, isConnected]);

  const handleSave = useCallback(async () => {
    const trimmed = displayName.trim();
    if (!trimmed) { setError("Display name is required."); return; }
    if (!address) { setError("Wallet not connected."); return; }

    const pid = getProfileId(address);
    if (!pid) { setError("Invalid wallet address."); return; }

    setSaving(true);
    setError("");

    try {
      await upsertProfile({
        displayName: trimmed,
        walletAddress: address,
      }, pid);

      if (avatarFile) {
        try {
          await uploadProfileAvatar(pid, avatarFile);
        } catch {
          setError("Profile saved, but avatar upload failed.");
        }
      }

      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }, [displayName, address, avatarFile, router]);

  const initials = displayName.trim()
    ? displayName.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase()
    : "?";

  return (
      <main style={{ maxWidth: 480, margin: "0 auto", padding: "2.5rem 1.5rem 4rem" }}>
        {!checkedProfile ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "4rem 0" }}>
            <div className="spinner spinner-lg" />
          </div>
        ) : alreadyHasProfile ? (
          <div className="card animate-fade-in" style={{ padding: "2rem", textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--green-light)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", color: "var(--green)", fontWeight: 900, fontSize: "1.25rem" }}>✓</div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>Profile Already Exists</h2>
            <p style={{ color: "var(--text-2)", fontSize: "0.875rem", marginBottom: "1.25rem" }}>
              You already have a profile for wallet {shortenAddress(address ?? "")}. Go to the dashboard.
            </p>
            <button onClick={() => router.push("/")} className="btn-primary">Go to Dashboard</button>
          </div>
        ) : (
          <div className="card animate-fade-in" style={{ padding: "2rem" }}>
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--blue-light)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "0.75rem", fontSize: "1.25rem" }}>👤</div>
              <h1 style={{ fontSize: "1.375rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "0.25rem" }}>
                Create Your Profile
              </h1>
              <p style={{ color: "var(--text-2)", fontSize: "0.875rem" }}>
                Set up your identity to start splitting expenses.
              </p>
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <ProfileAvatarUpload
                currentAvatarURL={undefined}
                displayName={displayName || "You"}
                onImageChange={(file) => setAvatarFile(file)}
                onError={(msg) => setError(msg)}
              />
            </div>

            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--text)" }}>
                Display Name *
              </label>
              <input
                className="input-field"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={50}
                autoFocus
              />
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--text)" }}>
                Wallet Address
              </label>
              <input
                className="input-field mono"
                value={address ? `${address.slice(0, 10)}...${address.slice(-6)}` : ""}
                readOnly
                style={{ fontSize: "0.8125rem", opacity: 0.7, cursor: "not-allowed" }}
              />
              {!isConnected && (
                <p style={{ fontSize: "0.75rem", color: "var(--red)", marginTop: "0.375rem", fontWeight: 600 }}>
                  Connect your wallet to create a profile.
                </p>
              )}
            </div>

            {error && (
              <div style={{ padding: "0.75rem 1rem", background: "var(--red-light)", border: "1px solid var(--error-border)", borderRadius: 8, fontSize: "0.8125rem", color: "var(--red)", fontWeight: 600, marginBottom: "1rem" }}>
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !isConnected}
              className="btn-primary"
              style={{ width: "100%", justifyContent: "center", padding: "0.75rem", opacity: saving || !isConnected ? 0.7 : 1 }}
            >
              {saving ? "Saving..." : !isConnected ? "Connect Wallet First" : "Create Profile →"}
            </button>
          </div>
        )}
      </main>
  );
}