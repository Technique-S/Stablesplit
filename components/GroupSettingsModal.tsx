"use client";

import { FormEvent, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { updateGroup, uploadGroupImage } from "@/lib/db";
import { Balance, Group, Member } from "@/lib/types";
import {
  createMember,
  memberInitials,
  memberWalletMap,
  shortenAddress,
  validateEvmAddress,
} from "@/lib/members";
import { useWalletReady } from "./WalletProvider";
import GroupImageUpload from "./GroupImageUpload";
import ConfirmModal from "./ConfirmModal";

interface Props {
  group: Group;
  balances: Balance[];
  onClose: () => void;
  onSaved: (group: Group) => void;
}

const CURRENCIES = ["USD", "EUR", "GBP", "NGN", "JPY", "CAD", "AUD", "INR"];

export default function GroupSettingsModal({ group, balances, onClose, onSaved }: Props) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? "");
  const [currency, setCurrency] = useState(group.currency);
  const [members, setMembers] = useState<Member[]>(group.members);
  const [memberInput, setMemberInput] = useState("");
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [imageFile, setImageFile] = useState<Blob | null>(null);
  const walletReady = useWalletReady();

  const balanceByMember = useMemo(() => {
    return new Map(balances.map((balance) => [balance.member, balance.net]));
  }, [balances]);

  const addMember = () => {
    const trimmed = memberInput.trim();
    if (!trimmed) return;
    if (members.some((member) => member.displayName.toLowerCase() === trimmed.toLowerCase())) {
      setError("Member already exists.");
      return;
    }
    setMembers([...members, createMember(trimmed)]);
    setMemberInput("");
    setError("");
  };

  const updateMember = (memberId: string, patch: Partial<Member>) => {
    setMembers((current) => current.map((member) => member.id === memberId ? { ...member, ...patch } : member));
  };

  const removeMember = (member: Member, confirmed = false) => {
    const net = balanceByMember.get(member.displayName) ?? 0;
    if (!confirmed && Math.abs(net) > 0.01) {
      setPendingRemove(member.id);
      return;
    }
    setMembers(members.filter((existing) => existing.id !== member.id));
    setPendingRemove(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) { setError("Group name is required."); return; }
    if (members.length < 1) { setError("Keep at least one member."); return; }

    const cleanedMembers = members.map((member) => ({
      ...member,
      displayName: member.displayName.trim(),
      walletAddress: member.walletAddress?.trim() || undefined,
    }));

    const duplicateName = cleanedMembers.find((member, index) => {
      const name = member.displayName.toLowerCase();
      return cleanedMembers.findIndex((existing) => existing.displayName.toLowerCase() === name) !== index;
    });
    if (duplicateName) {
      setError(`${duplicateName.displayName} appears more than once.`);
      return;
    }

    const invalidWallet = cleanedMembers.find((member) => member.walletAddress && !validateEvmAddress(member.walletAddress));
    if (invalidWallet) {
      setError(`Enter a valid EVM wallet address for ${invalidWallet.displayName}.`);
      return;
    }

    setLoading(true);
    setError("");

    let photoURL = group.photoURL;
    if (imageFile) {
      try {
        photoURL = await uploadGroupImage(group.id, imageFile);
      } catch {
        setError("Failed to upload image.");
        setLoading(false);
        return;
      }
    }

    const nextGroup = {
      ...group,
      name: name.trim(),
      description: description.trim(),
      currency,
      members: cleanedMembers,
      memberWallets: memberWalletMap(cleanedMembers),
      photoURL,
    };

    onSaved(nextGroup);
    try {
      await updateGroup(group.id, nextGroup);
    } catch (e) {
      setError("Failed to save group changes.");
      onSaved(group);
      setLoading(false);
      return;
    }
    setLoading(false);
    onClose();
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--overlay)",
          backdropFilter: "blur(4px)",
          zIndex: 100,
        }}
      />
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 101,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "clamp(0.75rem, 3vw, 2rem)",
          pointerEvents: "none",
        }}
      >
        <form
          onSubmit={handleSubmit}
          className="animate-scale-in"
          style={{
            display: "flex",
            flexDirection: "column",
            width: "min(560px, 100%)",
            maxHeight: "min(780px, calc(100dvh - 1.5rem))",
            background: "var(--surface)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-lg)",
            overflow: "hidden",
            pointerEvents: "auto",
          }}
        >
          <div style={{ padding: "1.5rem 1.75rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", gap: "1rem" }}>
            <div>
              <h2 style={{ fontWeight: 700, fontSize: "1.125rem", letterSpacing: "-0.02em" }}>Edit Group</h2>
              <p style={{ color: "var(--text-2)", fontSize: "0.8125rem", marginTop: "0.125rem" }}>
                Update group details and members
              </p>
            </div>
            <button type="button" onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--border)", cursor: "pointer", color: "var(--text-2)", fontSize: "1.25rem", lineHeight: 1, flexShrink: 0 }}>
              ×
            </button>
          </div>

          <div style={{ padding: "1.5rem 1.75rem", overflowY: "auto", flex: 1, minHeight: 0 }}>
            <div style={{ marginBottom: "1.25rem" }}>
              <GroupImageUpload
                groupName={name || group.name}
                currentPhotoURL={group.photoURL}
                onImageChange={(file) => setImageFile(file)}
                onError={(msg) => setError(msg)}
              />
            </div>

            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.5rem" }}>Group Name *</label>
              <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.5rem" }}>Description</label>
              <textarea className="input-field" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} style={{ resize: "vertical" }} />
            </div>

            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.5rem" }}>Currency</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {CURRENCIES.map((c) => (
                  <button key={c} type="button" onClick={() => setCurrency(c)} style={{ padding: "0.375rem 0.875rem", borderRadius: 6, fontSize: "0.8125rem", fontWeight: 600, border: `1.5px solid ${currency === c ? "var(--blue)" : "var(--border)"}`, background: currency === c ? "var(--blue-light)" : "transparent", color: currency === c ? "var(--blue)" : "var(--text-2)", cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ height: 1, background: "var(--border)", marginBottom: "1.25rem" }} />

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.5rem" }}>Members</label>
              <div className="member-input-row" style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <input className="input-field" value={memberInput} placeholder="Add member" onChange={(e) => setMemberInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addMember())} />
                <button type="button" onClick={addMember} className="btn-secondary" style={{ whiteSpace: "nowrap" }}>+ Add</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {members.map((member) => {
                  const net = balanceByMember.get(member.displayName) ?? 0;
                  const wallet = member.walletAddress?.trim();
                  return (
                    <div key={member.id} className="card" style={{ padding: "0.75rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                          <p style={{ fontSize: "0.875rem", fontWeight: 700 }}>{member.displayName}</p>
                          <WalletBadge wallet={wallet} />
                        </div>
                        <p style={{ fontSize: "0.75rem", color: Math.abs(net) > 0.01 ? "var(--red)" : "var(--text-3)" }}>
                          {Math.abs(net) > 0.01 ? `Unsettled balance: ${net.toFixed(2)} ${currency}` : "Settled"}
                        </p>
                        <MemberWalletInput
                          member={member.displayName}
                          value={member.walletAddress ?? ""}
                          walletReady={walletReady}
                          onChange={(value) => updateMember(member.id, { walletAddress: value })}
                        />
                      </div>
                      <button type="button" onClick={() => removeMember(member)} className="btn-secondary" style={{ padding: "0.4rem 0.65rem", color: "var(--red)" }}>
                        Delete
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {error && <div style={{ marginTop: "1rem", padding: "0.75rem 1rem", background: "var(--red-light)", border: "1px solid var(--error-border)", borderRadius: 8, fontSize: "0.8125rem", color: "var(--red)", fontWeight: 500 }}>{error}</div>}
          </div>

          <div style={{ padding: "1.25rem 1.75rem", borderTop: "1px solid var(--border)", display: "flex", gap: "0.75rem", justifyContent: "flex-end", flexWrap: "wrap", flexShrink: 0 }}>
            <button type="button" onClick={onClose} className="btn-secondary" disabled={loading}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading} style={{ opacity: loading ? 0.7 : 1 }}>{loading ? "Saving..." : "Save Changes"}</button>
          </div>
        </form>
      </div>

      {pendingRemove && (
        <ConfirmModal
          title="Remove unsettled member?"
          message={`${members.find((member) => member.id === pendingRemove)?.displayName ?? "This member"} still has an unsettled balance. Removing them will hide them from the group member list, but existing expenses can still reference them for settlement history.`}
          confirmLabel="Remove Member"
          danger
          onCancel={() => setPendingRemove(null)}
          onConfirm={() => {
            const member = members.find((existing) => existing.id === pendingRemove);
            if (member) removeMember(member, true);
          }}
        />
      )}
    </>
  );
}

function WalletBadge({ wallet }: { wallet?: string }) {
  const copyWallet = async () => {
    if (!wallet) return;
    await navigator.clipboard?.writeText(wallet);
  };

  if (!wallet) {
    return (
      <span className="badge" style={{ background: "var(--surface-2)", color: "var(--text-3)" }}>
        No wallet
      </span>
    );
  }

  return (
    <span className="badge mono" style={{ background: "var(--green-light)", color: "var(--green)", gap: "0.4rem" }}>
      {shortenAddress(wallet)}
      <button
        type="button"
        onClick={copyWallet}
        title="Copy wallet address"
        style={{ border: "none", background: "transparent", color: "inherit", cursor: "pointer", padding: 0, lineHeight: 1 }}
      >
        ⧉
      </button>
    </span>
  );
}

function MemberWalletInput({
  member,
  value,
  walletReady,
  onChange,
}: {
  member: string;
  value: string;
  walletReady: boolean;
  onChange: (value: string) => void;
}) {
  if (!walletReady) {
    return (
      <input
        className="input-field mono"
        placeholder={`${member}'s wallet address`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ marginTop: "0.5rem", fontSize: "0.75rem" }}
      />
    );
  }

  return <ConnectedMemberWalletInput member={member} value={value} onChange={onChange} />;
}

function ConnectedMemberWalletInput({
  member,
  value,
  onChange,
}: {
  member: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { address, isConnected } = useAccount();

  return (
    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
      <input
        className="input-field mono"
        placeholder={`${member}'s wallet address`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ flex: 1, minWidth: 180, fontSize: "0.75rem" }}
      />
      {isConnected && address && (
        <button
          type="button"
          className="btn-secondary"
          onClick={() => onChange(address)}
          style={{ padding: "0.5rem 0.65rem", fontSize: "0.75rem" }}
        >
          Use mine
        </button>
      )}
    </div>
  );
}
