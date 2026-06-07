"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import OnboardingScreen from "@/components/OnboardingScreen";
import { getAllGroups, getExpenses, getGroupActivity, getSettlementPayments } from "@/lib/db";
import { getProfileId } from "@/lib/local-profile";
import { getProfile } from "@/lib/profile";
import { Group, Balance, SettlementPayment, ActivityRecord } from "@/lib/types";
import { memberInitials, memberNames } from "@/lib/members";

interface GroupBalance {
  groupId: string;
  groupName: string;
  currency: string;
  net: number;
  displayName: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState("");
  const [error, setError] = useState("");

  const [groupBalances, setGroupBalances] = useState<GroupBalance[]>([]);
  const [recentSettlements, setRecentSettlements] = useState<SettlementPayment[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityRecord[]>([]);
  const [aggregateLoading, setAggregateLoading] = useState(false);

  const [lastActiveGroupId, setLastActiveGroupId] = useState<string | null>(null);

  useEffect(() => {
    const pid = getProfileId(address);
    setProfileId(pid);
    if (pid) {
      getProfile(pid).then((p) => {
        setProfileReady(!!p);
        setLoading(false);
      }).catch(() => {
        setProfileReady(false);
        setLoading(false);
      });
    } else {
      setProfileReady(false);
      setLoading(false);
    }
  }, [address]);

  const loadData = useCallback(async () => {
    if (!profileId) return;
    setError("");
    setAggregateLoading(true);
    try {
      const profile = await getProfile(profileId);
      if (!profile || (profile.joinedGroupIds.length === 0 && profile.createdGroupIds.length === 0)) {
        const groups = await getAllGroups();
        setAllGroups(groups);
        setLoading(false);
        return;
      }

      const groupIds = [...new Set([...profile.createdGroupIds, ...profile.joinedGroupIds])];
      const groups = await getAllGroups();
      const filtered = groups.filter((g) => groupIds.includes(g.id));
      const createdSet = new Set(profile.createdGroupIds);
      const joinedSet = new Set(profile.joinedGroupIds);

      const ordered = [
        ...filtered.filter((g) => createdSet.has(g.id)).sort((a, b) => b.createdAt - a.createdAt),
        ...filtered.filter((g) => !createdSet.has(g.id) && joinedSet.has(g.id)).sort((a, b) => b.createdAt - a.createdAt),
      ];

      setAllGroups(ordered);

      if (ordered.length === 0) {
        setLoading(false);
        return;
      }

      const lastGroup = localStorage.getItem("stablesplit-last-group");
      if (lastGroup && ordered.some((g) => g.id === lastGroup)) {
        setLastActiveGroupId(lastGroup);
      } else {
        const newest = ordered.reduce((a, b) => a.createdAt > b.createdAt ? a : b);
        setLastActiveGroupId(newest.id);
      }

      setAggregateLoading(true);

      const expenseResults = await Promise.allSettled(
        ordered.map((g) => getExpenses(g.id))
      );

      const settlementResults = await Promise.allSettled(
        ordered.map((g) => getSettlementPayments(g.id))
      );

      const activityResults = await Promise.allSettled(
        ordered.map((g) => getGroupActivity(g.id))
      );

      const userDisplayName = profile.displayName || "";
      const computedBalances: GroupBalance[] = [];

      expenseResults.forEach((result, idx) => {
        const group = ordered[idx];
        if (result.status !== "fulfilled" || !userDisplayName) {
          computedBalances.push({
            groupId: group.id,
            groupName: group.name,
            currency: group.currency,
            net: 0,
            displayName: userDisplayName,
          });
          return;
        }
        const expenses = result.value;
        const paidByUser = expenses
          .filter((e) => !e.lockedAt && e.paidBy === userDisplayName)
          .reduce((sum, e) => sum + e.amount, 0);
        const shareOfUser = expenses
          .filter((e) => !e.lockedAt && e.splitAmong.includes(userDisplayName))
          .reduce((sum, e) => sum + e.amount / e.splitAmong.length, 0);
        computedBalances.push({
          groupId: group.id,
          groupName: group.name,
          currency: group.currency,
          net: paidByUser - shareOfUser,
          displayName: userDisplayName,
        });
      });

      setGroupBalances(computedBalances);

      const allSettlements = settlementResults
        .flatMap((r, idx) => {
          if (r.status !== "fulfilled") return [];
          return r.value.map((s) => ({ ...s, groupName: ordered[idx]?.name ?? "" }));
        })
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 10);
      setRecentSettlements(allSettlements);

      const allActivity = activityResults
        .flatMap((r, idx) => {
          if (r.status !== "fulfilled") return [];
          return r.value.map((a) => ({ ...a, groupName: ordered[idx]?.name ?? "" }));
        })
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 20);
      setRecentActivity(allActivity);

      setAggregateLoading(false);
    } catch (e) {
      console.error("[Dashboard] Failed to load data.", e);
      setError("Failed to load dashboard data.");
    } finally {
      setLoading(false);
      setAggregateLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    if (!profileReady || !profileId) return;
    void loadData();
  }, [loadData, profileReady, profileId]);

  const handleGenerateDemo = useCallback(async () => {
    const { generateDemoGroup } = await import("@/lib/db");
    setDemoLoading(true);
    setDemoError("");
    try {
      const groupId = await generateDemoGroup();
      router.push(`/group/${groupId}?demo=1`);
    } catch (e) {
      console.error("[Dashboard] Failed to generate demo group.", e);
      setDemoError("Could not generate demo group. Check Firestore connectivity.");
    } finally {
      setDemoLoading(false);
    }
  }, [router]);

  const handleOpenLastActive = () => {
    if (lastActiveGroupId) {
      router.push(`/group/${lastActiveGroupId}`);
    }
  };

  const handleGroupClick = (groupId: string) => {
    localStorage.setItem("stablesplit-last-group", groupId);
  };

  const createdGroups = useMemo(
    () => allGroups.filter((g) => g.templateType || !profileId),
    [allGroups, profileId]
  );

  const totalOutstanding = useMemo(
    () => groupBalances.filter((gb) => gb.net > 0).reduce((sum, gb) => sum + gb.net, 0),
    [groupBalances]
  );

  const totalOwed = useMemo(
    () => groupBalances.filter((gb) => gb.net < 0).reduce((sum, gb) => sum + Math.abs(gb.net), 0),
    [groupBalances]
  );

  const avatarColor = (name: string) => {
    const colors = ["var(--avatar-1)", "var(--avatar-2)", "var(--avatar-3)", "var(--avatar-4)", "var(--avatar-5)", "var(--avatar-6)"];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const hasProfileData = allGroups.length > 0;

  if (!loading && (!profileReady || !profileId)) {
    return (
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "2.5rem 1.5rem 4rem" }}>
          <OnboardingScreen />
        </main>
    );
  }

  return (
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "2.5rem 1.5rem 4rem" }}>
        {/* Hero */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text)", marginBottom: "0.25rem" }}>
              Dashboard
            </h1>
            <p style={{ color: "var(--text-2)", fontSize: "0.9375rem" }}>
              Overview of all your groups, balances, and activity.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {lastActiveGroupId && hasProfileData && (
              <button onClick={handleOpenLastActive} className="btn-secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.8125rem" }}>
                Open Last Active
              </button>
            )}
            <button onClick={handleGenerateDemo} disabled={demoLoading} className="btn-secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.8125rem" }}>
              {demoLoading ? "Generating..." : "⚡ Demo"}
            </button>
            <Link href="/create" style={{ textDecoration: "none" }}>
              <button className="btn-primary" style={{ padding: "0.5rem 1rem", fontSize: "0.8125rem" }}>
                + Create Group
              </button>
            </Link>
          </div>
        </div>

        {demoError && (
          <div style={{ marginBottom: "1.25rem", padding: "0.75rem 1rem", background: "var(--red-light)", border: "1px solid var(--error-border)", borderRadius: 8, fontSize: "0.8125rem", color: "var(--red)", fontWeight: 600 }}>
            {demoError}
          </div>
        )}
        {error && (
          <div style={{ marginBottom: "1.25rem", padding: "0.75rem 1rem", background: "var(--red-light)", border: "1px solid var(--error-border)", borderRadius: 8, fontSize: "0.8125rem", color: "var(--red)", fontWeight: 600 }}>
            {error}
          </div>
        )}

        {/* Stats */}
        {hasProfileData && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
            <div className="card" style={{ padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{ width: 40, height: 40, background: "var(--blue-light)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.125rem", color: "var(--blue)", fontWeight: 700 }}>
                ⬡
              </div>
              <div>
                <div className="mono" style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" }}>{allGroups.length}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-2)", fontWeight: 500 }}>Groups</div>
              </div>
            </div>
            <div className="card" style={{ padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{ width: 40, height: 40, background: "var(--green-light)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.125rem", color: "var(--green)", fontWeight: 700 }}>
                +
              </div>
              <div>
                <div className="mono" style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
                  {aggregateLoading ? "..." : `${allGroups[0]?.currency ?? ""} ${totalOutstanding.toFixed(2)}`}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-2)", fontWeight: 500 }}>Owed to you</div>
              </div>
            </div>
            {totalOwed > 0 && (
              <div className="card" style={{ padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                <div style={{ width: 40, height: 40, background: "var(--red-light)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.125rem", color: "var(--red)", fontWeight: 700 }}>
                  -
                </div>
                <div>
                  <div className="mono" style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
                    {aggregateLoading ? "..." : `${allGroups[0]?.currency ?? ""} ${totalOwed.toFixed(2)}`}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-2)", fontWeight: 500 }}>You owe</div>
                </div>
              </div>
            )}
            <div className="card" style={{ padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{ width: 40, height: 40, background: "var(--surface-2)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.125rem", color: "var(--text-2)", fontWeight: 700 }}>
                ◎
              </div>
              <div>
                <div className="mono" style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
                  {aggregateLoading ? "..." : recentSettlements.length}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-2)", fontWeight: 500 }}>Settlements</div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div>
            <div className="stagger-children" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(260px, 100%), 1fr))", gap: "1rem" }}>
              {[1, 2, 3].map((i) => (
                <div key={i} className="card" style={{ padding: "1.5rem", height: 160 }}>
                  <div style={{ background: "var(--surface-2)", borderRadius: 8, height: 20, width: "60%", marginBottom: "0.75rem" }} />
                  <div style={{ background: "var(--surface-2)", borderRadius: 8, height: 14, width: "40%" }} />
                </div>
              ))}
            </div>
          </div>
        ) : !hasProfileData ? (
          <div className="card animate-fade-in" style={{ padding: "4rem 2rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
            <div style={{ width: 64, height: 64, background: "var(--blue-light)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.75rem" }}>
              ⬡
            </div>
            <div>
              <p style={{ fontWeight: 600, fontSize: "1rem", marginBottom: "0.25rem" }}>No groups yet</p>
              <p style={{ color: "var(--text-2)", fontSize: "0.875rem" }}>
                Create your first group to start splitting expenses.
              </p>
            </div>
            <Link href="/create" style={{ textDecoration: "none" }}>
              <button className="btn-primary">Create your first group</button>
            </Link>
          </div>
        ) : (
          <>
            {/* Groups grid */}
            <section style={{ marginBottom: "2rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h2 style={{ fontSize: "1.125rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
                  Your Groups
                </h2>
                <Link href="/create" style={{ color: "var(--blue)", fontWeight: 600, fontSize: "0.8125rem", textDecoration: "none" }}>
                  + New Group
                </Link>
              </div>
              <div className="stagger-children" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(260px, 100%), 1fr))", gap: "1rem" }}>
                {allGroups.map((group) => (
                  <Link key={group.id} href={`/group/${group.id}`} onClick={() => handleGroupClick(group.id)} style={{ textDecoration: "none" }}>
                    <div className="card card-hover" style={{ padding: "1.5rem", cursor: "pointer", height: "100%", display: "flex", flexDirection: "column" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {group.photoURL ? (
                            <img src={group.photoURL} alt={group.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <div style={{ width: "100%", height: "100%", background: avatarColor(group.name), display: "flex", alignItems: "center", justifyContent: "center", color: "var(--avatar-text)", fontWeight: 700, fontSize: "1rem", letterSpacing: "-0.01em" }}>
                              {group.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <span className="badge" style={{ background: "var(--blue-light)", color: "var(--blue)" }}>{group.currency}</span>
                      </div>

                      <h3 style={{ fontWeight: 700, fontSize: "1rem", letterSpacing: "-0.02em", marginBottom: "0.25rem", color: "var(--text)" }}>
                        {group.name}
                        {group.isDemo && (
                          <span className="badge" style={{ marginLeft: "0.5rem", background: "var(--blue-light)", color: "var(--blue)", fontWeight: 600, verticalAlign: "middle" }}>
                            🏷 Demo
                          </span>
                        )}
                      </h3>
                      {group.description && (
                        <p style={{ color: "var(--text-2)", fontSize: "0.8125rem", marginBottom: "0.75rem", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>
                          {group.description}
                        </p>
                      )}

                      {/* Balance chip */}
                      {!aggregateLoading && (() => {
                        const bal = groupBalances.find((gb) => gb.groupId === group.id);
                        if (!bal) return null;
                        if (Math.abs(bal.net) < 0.01) {
                          return <p style={{ fontSize: "0.75rem", color: "var(--text-3)", marginTop: "auto", marginBottom: "0.5rem" }}>Settled up</p>;
                        }
                        const isOwed = bal.net > 0;
                        return (
                          <p style={{ fontSize: "0.8125rem", fontWeight: 700, marginTop: "auto", marginBottom: "0.5rem" }}>
                            {isOwed ? (
                              <span style={{ color: "var(--green)" }}>+{group.currency} {bal.net.toFixed(2)}</span>
                            ) : (
                              <span style={{ color: "var(--red)" }}>-{group.currency} {Math.abs(bal.net).toFixed(2)}</span>
                            )}
                          </p>
                        );
                      })()}

                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "auto" }}>
                        <div style={{ display: "flex" }}>
                          {group.members.slice(0, 4).map((m, idx) => (
                            <div key={m.id} style={{ width: 26, height: 26, borderRadius: "50%", background: m.avatarColor ?? avatarColor(m.displayName), border: "2px solid var(--avatar-ring)", marginLeft: idx === 0 ? 0 : -8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.625rem", fontWeight: 700, color: "var(--avatar-text)", zIndex: idx }}>
                              {memberInitials(m).slice(0, 1)}
                            </div>
                          ))}
                        </div>
                        <span style={{ fontSize: "0.8125rem", color: "var(--text-2)" }}>
                          {group.members.length} member{group.members.length !== 1 ? "s" : ""}
                        </span>
                        <span style={{ marginLeft: "auto", color: "var(--text-3)", fontSize: "0.75rem" }}>
                          {new Date(group.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            {/* Two-column: Balances + Quick Actions */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "2rem" }}>
              {/* Balances table */}
              <div className="card" style={{ padding: "1.5rem" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "1rem" }}>
                  Balances Overview
                </h3>
                {aggregateLoading ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {[1, 2, 3].map((i) => (
                      <div key={i} style={{ height: 20, width: "80%", background: "var(--surface-2)", borderRadius: 6 }} />
                    ))}
                  </div>
                ) : groupBalances.length === 0 ? (
                  <p style={{ color: "var(--text-2)", fontSize: "0.875rem" }}>No balance data yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                    {groupBalances.map((gb) => (
                      <Link key={gb.groupId} href={`/group/${gb.groupId}`} onClick={() => handleGroupClick(gb.groupId)} style={{ textDecoration: "none" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0.75rem", borderRadius: 8, transition: "background 0.15s" }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-2)"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                        >
                          <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text)" }}>{gb.groupName}</span>
                          {Math.abs(gb.net) < 0.01 ? (
                            <span style={{ fontSize: "0.8125rem", color: "var(--text-3)" }}>—</span>
                          ) : gb.net > 0 ? (
                            <span className="mono" style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--green)" }}>
                              +{gb.currency} {gb.net.toFixed(2)}
                            </span>
                          ) : (
                            <span className="mono" style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--red)" }}>
                              -{gb.currency} {Math.abs(gb.net).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </Link>
                    ))}
                    <div style={{ borderTop: "1px solid var(--border)", marginTop: "0.25rem", paddingTop: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.875rem", fontWeight: 700 }}>Net Total</span>
                      <span className="mono" style={{ fontSize: "0.875rem", fontWeight: 700, color: totalOutstanding >= totalOwed ? "var(--green)" : "var(--red)" }}>
                        {totalOutstanding >= totalOwed ? "+" : "-"}
                        {allGroups[0]?.currency ?? ""} {Math.abs(totalOutstanding - totalOwed).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="card" style={{ padding: "1.5rem" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "1rem" }}>
                  Quick Actions
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <Link href="/create" style={{ textDecoration: "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1rem", borderRadius: 10, background: "var(--surface-2)", transition: "background 0.15s", cursor: "pointer" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-3)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "var(--surface-2)"}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--blue-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", flexShrink: 0 }}>+</div>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text)" }}>Create Group</p>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>Start a new expense group</p>
                      </div>
                    </div>
                  </Link>
                  {lastActiveGroupId && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1rem", borderRadius: 10, background: "var(--surface-2)", transition: "background 0.15s", cursor: "pointer" }}
                      onClick={handleOpenLastActive}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-3)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "var(--surface-2)"}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", flexShrink: 0 }}>
                        →
                      </div>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text)" }}>Open Last Active Group</p>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>Jump back to where you left off</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <section>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "1rem" }}>
                Recent Activity
              </h2>
              {aggregateLoading ? (
                <div className="card" style={{ padding: "1.5rem" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--surface-2)", flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ height: 14, width: "60%", background: "var(--surface-2)", borderRadius: 6, marginBottom: "0.25rem" }} />
                          <div style={{ height: 12, width: "30%", background: "var(--surface-2)", borderRadius: 6 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : recentActivity.length === 0 && recentSettlements.length === 0 ? (
                <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
                  <p style={{ color: "var(--text-2)", fontSize: "0.875rem" }}>No recent activity across your groups.</p>
                </div>
              ) : (
                <div className="card" style={{ padding: "1rem 1.5rem" }}>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {[
                      ...recentSettlements.map((s) => ({
                        key: `settle-${s.id}`,
                        type: "settlement" as const,
                        groupName: (s as SettlementPayment & { groupName: string }).groupName,
                        groupId: s.groupId,
                        description: settlementDescription(s),
                        createdAt: s.createdAt,
                      })),
                      ...recentActivity.slice(0, 15).map((a) => ({
                        key: `activity-${a.id}`,
                        type: "activity" as const,
                        groupName: (a as ActivityRecord & { groupName: string }).groupName,
                        groupId: a.groupId,
                        description: a.description,
                        createdAt: a.createdAt,
                      })),
                    ]
                      .sort((a, b) => b.createdAt - a.createdAt)
                      .slice(0, 20)
                      .map((item) => (
                        <Link key={item.key} href={`/group/${item.groupId}`} onClick={() => handleGroupClick(item.groupId)} style={{ textDecoration: "none" }}>
                          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", padding: "0.75rem 0", borderBottom: "1px solid var(--border)", transition: "opacity 0.15s" }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = "0.8"}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                          >
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: item.type === "settlement" ? "var(--green-light)" : "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", flexShrink: 0 }}>
                              {item.type === "settlement" ? "✓" : "●"}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {item.description}
                              </p>
                              <p style={{ fontSize: "0.75rem", color: "var(--text-3)", marginTop: "0.125rem" }}>
                                {item.groupName} · {formatTime(item.createdAt)}
                              </p>
                            </div>
                          </div>
                        </Link>
                      ))}
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </main>
  );
}

function settlementDescription(s: SettlementPayment): string {
  if (s.status === "paid") {
    return `${s.from} paid ${s.to} ${s.currency} ${s.amount.toFixed(2)}`;
  }
  if (s.status === "pending") {
    return `${s.from} owes ${s.to} ${s.currency} ${s.amount.toFixed(2)} (pending)`;
  }
  return `${s.from} → ${s.to}: ${s.currency} ${s.amount.toFixed(2)}`;
}