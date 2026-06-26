"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import ProfileAvatarUpload from "@/components/profile/ProfileAvatarUpload";
import { setProfileId } from "@/lib/client/local-profile";
import { getProfileByWalletAddress, getProfile, upsertProfile, uploadProfileAvatar, addJoinedGroupId } from "@/lib/client/profile";
import { getGroups } from "@/lib/client/groups";
import { Group, UserProfile } from "@/lib/types";
import { validateEvmAddress, shortenAddress } from "@/lib/domain/members";
import { useWalletReady } from "@/components/wallet/WalletProvider";

export default function ProfilePage() {
  const router = useRouter();
  const walletReady = useWalletReady();
  const { address, isConnected } = useAccount();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editWallet, setEditWallet] = useState("");
  const [avatarFile, setAvatarFile] = useState<Blob | null>(null);
  const [saving, setSaving] = useState(false);

  const [joinedGroups, setJoinedGroups] = useState<Group[]>([]);
  const [createdGroups, setCreatedGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError("");
    try {
      const p = await getProfileByWalletAddress(address);
      setProfile(p);
      if (p) {
        setProfileId(p.id);
        setEditName(p.displayName);
        setEditWallet(p.walletAddress ?? "");
      }
    } catch {
      setError("Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }, [address]);

  const loadGroups = useCallback(async (p: UserProfile) => {
    if (!address) return;
    setGroupsLoading(true);
    try {
      const allIds = [...new Set([...p.createdGroupIds, ...p.joinedGroupIds])];
      if (allIds.length === 0) {
        setJoinedGroups([]);
        setCreatedGroups([]);
        setGroupsLoading(false);
        return;
      }
      const groups = await getGroups(address);
      setJoinedGroups(groups.filter((g) => p.joinedGroupIds.includes(g.id)));
      setCreatedGroups(groups.filter((g) => p.createdGroupIds.includes(g.id)));
    } catch {
      // ignore group load errors
    } finally {
      setGroupsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (profile) {
      void loadGroups(profile);
    }
  }, [profile, loadGroups]);

  useEffect(() => {
    if (isConnected && address && profile && !editWallet) {
      setEditWallet(address);
    }
  }, [isConnected, address, profile, editWallet]);

  const handleSave = async () => {
    const trimmedName = editName.trim();
    if (!trimmedName) { setError("Display name is required."); return; }
    const trimmedWallet = editWallet.trim();
    if (trimmedWallet && !validateEvmAddress(trimmedWallet)) {
      setError("Enter a valid EVM wallet address.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await upsertProfile({
        displayName: trimmedName,
        walletAddress: trimmedWallet || undefined,
      }, address ?? "");
      const currentProfileId = result?.id ?? profile?.id ?? "";
      if (result?.id) {
        setProfileId(result.id);
      }
      if (avatarFile && currentProfileId) {
        try {
          await uploadProfileAvatar(currentProfileId, avatarFile);
        } catch {
          setError("Profile saved, but avatar upload failed.");
        }
        setAvatarFile(null);
      }
      setSuccess("Profile saved.");
      setEditing(false);
      await loadProfile();
    } catch {
      setError("Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      setEditName(profile.displayName);
      setEditWallet(profile.walletAddress ?? "");
    }
    setAvatarFile(null);
    setError("");
    setEditing(false);
  };

  const handleUseWallet = () => {
    if (address) {
      setEditWallet(address);
    }
  };

  if (loading) {
    return (
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "2.5rem 1.5rem" }}>
          <div className="card" style={{ padding: "2rem" }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: "var(--surface-2)", margin: "0 auto 1rem" }} />
            <div style={{ height: 20, width: "40%", background: "var(--surface-2)", borderRadius: 6, margin: "0 auto 0.5rem" }} />
            <div style={{ height: 14, width: "60%", background: "var(--surface-2)", borderRadius: 6, margin: "0 auto" }} />
          </div>
      </main>
  );
  }

  const initials = profile
    ? profile.displayName.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase()
    : "?";

  return (
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "2.5rem 1.5rem 4rem" }}>
        <Link href="/" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.375rem", color: "var(--text-2)", fontSize: "0.875rem", marginBottom: "1.5rem", fontWeight: 500 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Back
        </Link>

        {error && (
          <div style={{ padding: "0.75rem 1rem", background: "var(--red-light)", border: "1px solid var(--error-border)", borderRadius: 8, fontSize: "0.8125rem", color: "var(--red)", fontWeight: 600, marginBottom: "1rem" }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ padding: "0.75rem 1rem", background: "rgba(0,200,83,0.1)", border: "1px solid var(--green)", borderRadius: 8, fontSize: "0.8125rem", color: "var(--green)", fontWeight: 600, marginBottom: "1rem" }}>
            {success}
          </div>
        )}

        {!profile ? (
          <div className="card" style={{ padding: "3rem 2rem", textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", fontSize: "1.5rem", color: "var(--text-3)", fontWeight: 700 }}>
              ?
            </div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>No Profile Yet</h2>
            <p style={{ color: "var(--text-2)", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
              Create or join a group to set up your profile.
            </p>
            <Link href="/create" style={{ textDecoration: "none" }}>
              <button className="btn-primary">Create a Group</button>
            </Link>
          </div>
        ) : editing ? (
          <div className="card" style={{ padding: "2rem" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "1.5rem" }}>Edit Profile</h2>

            <div style={{ marginBottom: "1.5rem" }}>
              <ProfileAvatarUpload
                currentAvatarURL={profile.avatarURL}
                displayName={profile.displayName}
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
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={50}
              />
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--text)" }}>
                Wallet Address <span style={{ color: "var(--text-3)", fontWeight: 400 }}>(optional)</span>
              </label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  className="input-field mono"
                  placeholder="0x... or connect wallet"
                  value={editWallet}
                  onChange={(e) => setEditWallet(e.target.value)}
                  style={{ flex: 1, fontFamily: "Space Mono, monospace", fontSize: "0.8125rem" }}
                />
                {walletReady && isConnected && address && (
                  <button
                    type="button"
                    onClick={handleUseWallet}
                    className="btn-secondary"
                    style={{ padding: "0.625rem 0.75rem", whiteSpace: "nowrap", fontSize: "0.8125rem" }}
                  >
                    Use connected
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={handleCancel}
                className="btn-secondary"
                style={{ flex: 1, justifyContent: "center", padding: "0.75rem" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="btn-primary"
                style={{ flex: 1, justifyContent: "center", padding: "0.75rem", opacity: saving ? 0.7 : 1 }}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="card" style={{ padding: "2rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <div
                    style={{
                      width: 64, height: 64, borderRadius: "50%", flexShrink: 0,
                      background: profile.avatarURL ? "transparent" : "var(--surface-2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    {profile.avatarURL ? (
                      <img src={profile.avatarURL} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                    ) : (
                      <span style={{ fontSize: "1.5rem", color: "var(--text-3)", fontWeight: 700 }}>
                        {initials}
                      </span>
                    )}
                  </div>
                  <div>
                    <h1 style={{ fontSize: "1.375rem", fontWeight: 700, letterSpacing: "-0.03em" }}>
                      {profile.displayName}
                    </h1>
                    {profile.walletAddress ? (
                      <p className="mono" style={{ fontSize: "0.8125rem", color: "var(--green)", fontWeight: 600, marginTop: "0.125rem" }}>
                        {shortenAddress(profile.walletAddress)}
                      </p>
                    ) : (
                      <p style={{ fontSize: "0.8125rem", color: "var(--text-3)", marginTop: "0.125rem" }}>
                        No wallet linked
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="btn-secondary"
                  style={{ padding: "0.5rem 1rem", fontSize: "0.8125rem" }}
                >
                  Edit Profile
                </button>
              </div>

              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                <div className="stat-box" style={{
                  flex: 1, minWidth: 120, padding: "1rem", borderRadius: 10,
                  background: "var(--surface-2)", textAlign: "center",
                }}>
                  <div className="mono" style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text)" }}>
                    {profile.joinedGroupIds.length}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-3)", marginTop: "0.125rem", fontWeight: 500 }}>
                    Joined Groups
                  </div>
                </div>
                <div className="stat-box" style={{
                  flex: 1, minWidth: 120, padding: "1rem", borderRadius: 10,
                  background: "var(--surface-2)", textAlign: "center",
                }}>
                  <div className="mono" style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text)" }}>
                    {profile.createdGroupIds.length}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-3)", marginTop: "0.125rem", fontWeight: 500 }}>
                    Created Groups
                  </div>
                </div>
              </div>
            </div>

            {groupsLoading ? (
              <div className="card" style={{ padding: "2rem", marginTop: "1.5rem" }}>
                <div style={{ height: 18, width: "30%", background: "var(--surface-2)", borderRadius: 6, marginBottom: "1rem" }} />
                <div style={{ height: 60, background: "var(--surface-2)", borderRadius: 8 }} />
              </div>
            ) : (
              <>
                {createdGroups.length > 0 && (
                  <div style={{ marginTop: "1.5rem" }}>
                    <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.75rem", letterSpacing: "-0.01em" }}>
                      Created Groups
                    </h2>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {createdGroups.map((g) => (
                        <Link
                          key={g.id}
                          href={`/group/${g.id}`}
                          style={{ textDecoration: "none" }}
                        >
                          <div className="card" style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem", transition: "opacity 0.15s" }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = "0.8"}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                          >
                            <div
                              style={{
                                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                                background: g.photoURL ? "transparent" : "var(--blue-light)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                overflow: "hidden",
                              }}
                            >
                              {g.photoURL ? (
                                <img src={g.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10 }} />
                              ) : (
                                <span style={{ fontSize: "1rem", color: "var(--blue)", fontWeight: 700 }}>
                                  {g.name.slice(0, 2).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--text)" }}>
                                {g.name}
                              </p>
                              <p style={{ color: "var(--text-2)", fontSize: "0.75rem", marginTop: "0.125rem" }}>
                                {g.members.length} member{g.members.length !== 1 ? "s" : ""} · {g.currency}
                              </p>
                            </div>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: "var(--text-3)" }}>
                              <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {joinedGroups.length > 0 && (
                  <div style={{ marginTop: "1.5rem" }}>
                    <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.75rem", letterSpacing: "-0.01em" }}>
                      Joined Groups
                    </h2>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {joinedGroups.map((g) => (
                        <Link
                          key={g.id}
                          href={`/group/${g.id}`}
                          style={{ textDecoration: "none" }}
                        >
                          <div className="card" style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem", transition: "opacity 0.15s" }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = "0.8"}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                          >
                            <div
                              style={{
                                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                                background: g.photoURL ? "transparent" : "var(--surface-2)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                overflow: "hidden",
                              }}
                            >
                              {g.photoURL ? (
                                <img src={g.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10 }} />
                              ) : (
                                <span style={{ fontSize: "1rem", color: "var(--text-2)", fontWeight: 700 }}>
                                  {g.name.slice(0, 2).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--text)" }}>
                                {g.name}
                              </p>
                              <p style={{ color: "var(--text-2)", fontSize: "0.75rem", marginTop: "0.125rem" }}>
                                {g.members.length} member{g.members.length !== 1 ? "s" : ""} · {g.currency}
                              </p>
                            </div>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: "var(--text-3)" }}>
                              <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {joinedGroups.length === 0 && createdGroups.length === 0 && (
                  <div className="card" style={{ padding: "2rem", marginTop: "1.5rem", textAlign: "center" }}>
                    <p style={{ color: "var(--text-2)", fontSize: "0.875rem" }}>
                      No groups yet. <Link href="/create" style={{ color: "var(--blue)", fontWeight: 600 }}>Create one</Link> or join via invite link.
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
  );
}