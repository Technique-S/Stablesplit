"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import Link from "next/link";
import { createGroup, uploadGroupImage } from "@/lib/client/db";
import GroupImageUpload from "@/components/group/GroupImageUpload";
import { createMember, memberInitials, shortenAddress, validateEvmAddress, getAvatarColor } from "@/lib/domain/members";
import { Member } from "@/lib/types";
import { useWalletReady } from "@/components/wallet/WalletProvider";
import { useProfileCheck } from "@/lib/use-profile-check";
import TemplatePicker from "@/components/shared/TemplatePicker";
import type { GroupTemplate } from "@/lib/domain/templates";
import { setProfileId } from "@/lib/client/local-profile";
import { getProfile, upsertProfile, addCreatedGroupId } from "@/lib/client/profile";

const CURRENCIES = ["USD", "EUR", "GBP", "NGN", "JPY", "CAD", "AUD", "INR"];

export default function CreateGroupPage() {
  const router = useRouter();
  const [template, setTemplate] = useState<GroupTemplate | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [memberInput, setMemberInput] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [imageFile, setImageFile] = useState<Blob | null>(null);
  const { address } = useAccount();
  const walletReady = useWalletReady();
  const { status: profileStatus, checking: profileChecking, profile, profileId } = useProfileCheck();
  const [creatorMember, setCreatorMember] = useState<Member | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    if (profileStatus !== "has-profile" || !profile) {
      setCreatorMember(null);
      setProfileLoaded(true);
      return;
    }
    if (profile.displayName) {
      const m = createMember(profile.displayName, profile.walletAddress || "");
      m.profileId = profileId ?? undefined;
      m.role = "owner";
      setCreatorMember(m);
    }
    setProfileLoaded(true);
  }, [profileStatus, profile, profileId]);

  const addMember = () => {
    const trimmed = memberInput.trim();
    if (!trimmed) return;
    if (members.some((member) => member.displayName.toLowerCase() === trimmed.toLowerCase())) {
      setError("Member already added.");
      return;
    }
    setMembers([...members, createMember(trimmed)]);
    setMemberInput("");
    setError("");
  };

  const removeMember = (memberId: string) => {
    if (creatorMember && memberId === creatorMember.id) return;
    setMembers(members.filter((member) => member.id !== memberId));
  };

  const updateMemberWallet = (memberId: string, walletAddress: string) => {
    setMembers((current) => current.map((member) => member.id === memberId ? { ...member, walletAddress } : member));
  };

  const resolveMemberWallet = useCallback(async (memberId: string, walletAddress: string) => {
    if (!walletAddress || !validateEvmAddress(walletAddress)) return;
    try {
      const res = await fetch(`/api/wallet/resolve?address=${encodeURIComponent(walletAddress)}`);
      const data = await res.json();
      if (data.found && data.displayName) {
        setMembers((current) => current.map((member) =>
          member.id === memberId ? { ...member, displayName: data.displayName, walletAddress } : member
        ));
      }
    } catch {
      // silent
    }
  }, []);

  const allMembers = creatorMember ? [creatorMember, ...members] : members;

  const handleSubmit = async () => {
    if (!name.trim()) { setError("Group name is required."); return; }
    if (!creatorMember) { setError("You must have a profile to create a group. Create one first."); return; }
    const memberCount = creatorMember ? 1 + members.length : members.length;
    if (memberCount < 2) { setError("Add at least one more member."); return; }
    const invalidWallet = allMembers.find((member) => member.walletAddress && !validateEvmAddress(member.walletAddress));
    if (invalidWallet) {
      setError(`Enter a valid EVM wallet address for ${invalidWallet.displayName}.`);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const profile = await upsertProfile({ displayName: creatorMember.displayName, walletAddress: creatorMember.walletAddress }, address ?? "");
      const resolvedProfileId = profile?.id ?? "";
      if (profile?.id) {
        setProfileId(profile.id);
      }
      const groupId = await createGroup(name.trim(), description.trim(), allMembers, currency, {}, template?.id, resolvedProfileId, address);
      if (resolvedProfileId && groupId) {
        await addCreatedGroupId(groupId, resolvedProfileId, address ?? "");
      }
      if (imageFile) {
        try {
          await uploadGroupImage(groupId, imageFile);
        } catch {
          setError("Group created, but image upload failed.");
          setLoading(false);
          return;
        }
      }
      router.push(`/group/${groupId}?created=1`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[create-group] Error:", error);
      setError("Failed to create group: " + msg);
      setLoading(false);
    }
  };

  return (
      <main style={{ maxWidth: 580, margin: "0 auto", padding: "2.5rem 1.5rem" }}>
        {/* Back */}
        <Link href="/" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.375rem", color: "var(--text-2)", fontSize: "0.875rem", marginBottom: "1.5rem", fontWeight: 500 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Back
        </Link>

        {profileChecking ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "4rem 0" }}>
            <div className="spinner spinner-lg" />
          </div>
        ) : profileStatus !== "has-profile" ? (
          <div className="card animate-fade-in" style={{ padding: "3rem 2rem", textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--blue-light)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", fontSize: "1.25rem" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="var(--blue)" strokeWidth="1.5"/><path d="M4 20c0-4 4-7 8-7s8 3 8 7" stroke="var(--blue)" strokeWidth="1.5"/></svg>
            </div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>Profile Required</h2>
            <p style={{ color: "var(--text-2)", fontSize: "0.875rem", marginBottom: "1.25rem" }}>
              You need to create a profile before you can create a group.
            </p>
            <Link href="/create-profile" style={{ textDecoration: "none" }}>
              <button className="btn-primary">Create Profile →</button>
            </Link>
          </div>
        ) : !template ? (
          <TemplatePicker onSelect={(t) => {
            setTemplate(t);
            if (t.id !== "custom") setDescription(t.description);
          }} />
        ) : (
        <div className="animate-fade-in">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.375rem" }}>
            <span style={{ fontSize: "1.5rem" }}>{template.emoji}</span>
            <h1 style={{ fontSize: "1.625rem", fontWeight: 700, letterSpacing: "-0.03em" }}>
              {template.label} Group
            </h1>
          </div>
          <p style={{ color: "var(--text-2)", fontSize: "0.9375rem", marginBottom: "2rem" }}>
            {template.description}
          </p>

          <div className="card" style={{ padding: "2rem" }}>
            <button
              type="button"
              onClick={() => setTemplate(null)}
              style={{ border: "none", background: "none", color: "var(--blue)", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 600, padding: 0, marginBottom: "1.25rem", fontFamily: "DM Sans, sans-serif" }}
            >
              ← Change template
            </button>

            {/* Group name */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--text)" }}>
                Group Name *
              </label>
              <input
                className="input-field"
                placeholder="e.g. Bali Trip 2025"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Description */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--text)" }}>
                Description <span style={{ color: "var(--text-3)", fontWeight: 400 }}>(optional)</span>
              </label>
              <textarea
                className="input-field"
                placeholder="What's this group for?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                style={{ resize: "none" }}
              />
            </div>

            {/* Currency */}
            <div style={{ marginBottom: "1.75rem" }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--text)" }}>
                Currency
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {CURRENCIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCurrency(c)}
                    style={{
                      padding: "0.375rem 0.875rem",
                      borderRadius: 6,
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      border: `1.5px solid ${currency === c ? "var(--blue)" : "var(--border)"}`,
                      background: currency === c ? "var(--blue-light)" : "transparent",
                      color: currency === c ? "var(--blue)" : "var(--text-2)",
                      cursor: "pointer",
                      transition: "all 0.15s",
                      fontFamily: "DM Sans, sans-serif",
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Group Image */}
            <div style={{ marginBottom: "1.75rem" }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--text)" }}>
                Group Image <span style={{ color: "var(--text-3)", fontWeight: 400 }}>(optional)</span>
              </label>
              <GroupImageUpload
                groupName={name || "G"}
                onImageChange={(file) => setImageFile(file)}
                onError={(msg) => setError(msg)}
              />
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "var(--border)", marginBottom: "1.75rem" }} />

            {/* Members */}
            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--text)" }}>
                Members <span style={{ color: "var(--text-3)", fontWeight: 400 }}>(you are auto-added)</span>
              </label>
              <div className="member-input-row" style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <input
                  className="input-field"
                  placeholder="Enter a name and press Add"
                  value={memberInput}
                  onChange={(e) => setMemberInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addMember()}
                  style={{ flex: 1 }}
                />
                <button
                  onClick={addMember}
                  className="btn-secondary"
                  style={{ whiteSpace: "nowrap" }}
                >
                  + Add
                </button>
              </div>

              {allMembers.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {allMembers.map((m) => {
                    const isCreator = creatorMember && m.id === creatorMember.id;
                    return (
                    <div
                      key={m.id}
                      className="animate-scale-in"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        flexWrap: "wrap",
                        padding: "0.375rem 0.625rem 0.375rem 0.5rem",
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        ...(isCreator ? { borderColor: "var(--blue-mid)", background: "var(--blue-light)" } : {}),
                      }}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          background: m.avatarColor ?? getAvatarColor(m.displayName),
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--avatar-text)",
                          fontSize: "0.625rem",
                          fontWeight: 700,
                        }}
                      >
                        {memberInitials(m).slice(0, 1)}
                      </div>
                      <span style={{ fontSize: "0.8125rem", fontWeight: 500 }}>
                        {m.displayName}
                        {isCreator && (
                          <span style={{ color: "var(--blue)", fontWeight: 600, fontSize: "0.75rem", marginLeft: "0.25rem" }}>
                            (You)
                          </span>
                        )}
                      </span>
                      {m.walletAddress && (
                        <span className="mono" style={{ fontSize: "0.6875rem", color: "var(--green)", fontWeight: 700 }}>
                          {shortenAddress(m.walletAddress)}
                        </span>
                      )}
                      {!isCreator && (
                      <button
                        onClick={() => removeMember(m.id)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--text-3)",
                          padding: "0 2px",
                          lineHeight: 1,
                          fontSize: "1rem",
                        }}
                      >
                        ×
                      </button>
                      )}
                      <div style={{ flexBasis: "100%", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <input
                          className="input-field mono"
                          placeholder="Wallet address"
                          value={m.walletAddress ?? ""}
                          onChange={(e) => updateMemberWallet(m.id, e.target.value)}
                          onBlur={(e) => resolveMemberWallet(m.id, e.target.value)}
                          style={{ fontSize: "0.75rem", padding: "0.45rem 0.625rem" }}
                        />
                        {walletReady && !isCreator && (
                          <ConnectedWalletFillButton onUse={(wallet) => updateMemberWallet(m.id, wallet)} />
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}

              {allMembers.length < 2 && allMembers.length > 0 && (
                <p style={{ fontSize: "0.75rem", color: "var(--text-3)", marginTop: "0.5rem" }}>
                  Add at least one more member.
                </p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div
                style={{
                  marginTop: "1rem",
                  padding: "0.75rem 1rem",
                  background: "var(--red-light)",
                  border: "1px solid var(--error-border)",
                  borderRadius: 8,
                  fontSize: "0.8125rem",
                  color: "var(--red)",
                  fontWeight: 500,
                }}
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="btn-primary"
              style={{ width: "100%", justifyContent: "center", marginTop: "1.5rem", padding: "0.75rem", opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Creating…" : "Create Group →"}
            </button>
          </div>
        </div>
        )}
      </main>
  );
}

function ConnectedWalletFillButton({ onUse }: { onUse: (wallet: string) => void }) {
  const { address, isConnected } = useAccount();
  if (!isConnected || !address) return null;

  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={() => onUse(address)}
      style={{ padding: "0.45rem 0.6rem", fontSize: "0.75rem", whiteSpace: "nowrap" }}
    >
      Use mine
    </button>
  );
}
