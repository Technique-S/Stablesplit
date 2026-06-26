"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAccount } from "wagmi";
import { Group, Expense, SettlementPayment, ActivityRecord } from "@/lib/types";
import { useProfileCheck } from "@/lib/use-profile-check";
import { calculateBalances, calculateSettlements, computeAdjustedBalances } from "@/lib/calculations";
import { getAvatarColor } from "@/lib/domain/members";
import { formatDate, formatDateTime, groupActivityByDate } from "@/lib/domain/date-utils";
import { activityIcon, activityIconBackground, activityIconColor, activityShortType } from "@/lib/domain/activity-helpers";

type ReportData = {
  group: Group;
  expenses: Expense[];
  completedPayments: SettlementPayment[];
  activityRecords: ActivityRecord[];
};

export default function ReportPage() {
  const { groupId } = useParams() as { groupId: string };
  const { address } = useAccount();
  const { status: profileStatus, checking: profileChecking } = useProfileCheck();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!groupId || !address) return;
    setLoading(true);
    setError("");

    (async () => {
      try {
        const res = await fetch(`/api/report/${groupId}`, {
          headers: { "x-wallet-address": address },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || `Request failed (${res.status})`);
        }
        const json = await res.json();
        const completedPayments = (json.settlementPayments as SettlementPayment[])
          .filter((p) => p.status === "paid" || p.settlementStatus === "paid")
          .sort((a, b) => (b.settledAt ?? b.updatedAt ?? b.createdAt) - (a.settledAt ?? a.updatedAt ?? a.createdAt));
        const activityRecords = (json.activityRecords as ActivityRecord[])
          .sort((a, b) => b.createdAt - a.createdAt);
        setData({ group: json.group, expenses: json.expenses, completedPayments, activityRecords });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load report.");
      }
      setLoading(false);
    })();
  }, [groupId, address]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  if (profileChecking) {
    return (
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>
          <div style={{ display: "flex", justifyContent: "center", padding: "4rem 0" }}>
            <div className="spinner spinner-lg" />
          </div>
        </main>
    );
  }

  if (profileStatus !== "has-profile") {
    return null;
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>
          <div style={{ display: "flex", justifyContent: "center", padding: "4rem 0" }}>
            <div className="spinner spinner-lg" />
          </div>
        </main>
    );
  }

  if (error || !data) {
    return (
        <main style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>
          <div className="card" style={{ padding: "3rem 2rem", textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>⚠️</div>
            <p style={{ fontWeight: 600, marginBottom: "0.25rem" }}>Report Unavailable</p>
            <p style={{ color: "var(--text-2)", fontSize: "0.875rem", marginBottom: "1rem" }}>
              {error || "This group report could not be loaded."}
            </p>
            <Link href="/" className="btn-primary" style={{ textDecoration: "none" }}>
              Back to Groups
            </Link>
          </div>
        </main>
    );
  }

  const { group, expenses, completedPayments, activityRecords } = data;

  const balances = calculateBalances(group.members, expenses);
  const adjustedBalances = computeAdjustedBalances(balances, completedPayments);
  const settlements = calculateSettlements(adjustedBalances);
  const totalSpend = expenses.reduce((s, e) => s + e.amount, 0);
  const totalSettled = completedPayments.reduce((sum, p) => sum + p.amount, 0);
  const outstandingDebt = adjustedBalances.reduce((sum, b) => sum + Math.max(0, b.net), 0);
  const memberPaidMap = new Map<string, number>();
  const memberOwedMap = new Map<string, number>();
  for (const exp of expenses) {
    memberPaidMap.set(exp.paidBy, (memberPaidMap.get(exp.paidBy) ?? 0) + exp.amount);
    for (const name of exp.splitAmong) {
      memberOwedMap.set(name, (memberOwedMap.get(name) ?? 0) + (exp.amount / exp.splitAmong.length));
    }
  }

  const groupedActivity = groupActivityByDate(activityRecords);

  const statCards = [
    { label: "Members", value: group.members.length, icon: "👥", color: "var(--blue)" },
    { label: "Expenses", value: expenses.length, icon: "🧾", color: "var(--category-transport)" },
    { label: "Total Spent", value: `${group.currency} ${totalSpend.toFixed(2)}`, icon: "💰", color: "var(--category-food)" },
    { label: "Settled", value: `${group.currency} ${totalSettled.toFixed(2)}`, icon: "✅", color: "var(--green)" },
    { label: "Outstanding", value: `${group.currency} ${outstandingDebt.toFixed(2)}`, icon: "⏳", color: outstandingDebt > 0.01 ? "var(--red)" : "var(--green)" },
    { label: "Payments Completed", value: completedPayments.length, icon: "↔", color: "var(--category-utilities)" },
  ];

  return (
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>
        {/* Header */}
        <div style={{ marginBottom: "1.5rem" }}>
          <Link href={`/group/${groupId}`} style={{ color: "var(--blue)", fontSize: "0.8125rem", textDecoration: "none", fontWeight: 600 }}>
            ← Back to Group
          </Link>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
            <div>
              <h1 style={{ fontWeight: 800, fontSize: "1.5rem", letterSpacing: "-0.03em", marginBottom: "0.25rem" }}>
                {group.name}
              </h1>
              <p style={{ color: "var(--text-2)", fontSize: "0.875rem" }}>
                Group Report · Created {formatDate(group.createdAt)}
                {group.description && ` · ${group.description}`}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyLink}
              className="btn-secondary"
              style={{ padding: "0.5rem 0.85rem", fontSize: "0.8125rem", whiteSpace: "nowrap", flexShrink: 0 }}
            >
              {copied ? "✓ Copied!" : "Copy Link"}
            </button>
          </div>
        </div>

        {/* Overview Stats */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "0.75rem",
          marginBottom: "1.5rem",
        }}>
          {statCards.map((stat) => (
            <div key={stat.label} className="card" style={{ padding: "0.75rem", textAlign: "center" }}>
              <div style={{
                width: 28, height: 28, margin: "0 auto 0.5rem", borderRadius: 8,
                background: stat.color + "18",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.8rem",
              }}>
                {stat.icon}
              </div>
              <div className="mono" style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--text)" }}>
                {stat.value}
              </div>
              <div style={{ fontSize: "0.6875rem", color: "var(--text-3)", marginTop: "0.125rem", fontWeight: 600 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Settlement Status */}
        {expenses.length > 0 && (
          <div className="card" style={{ padding: "1.25rem 1.5rem", marginBottom: "1.25rem" }}>
            <h2 style={{ fontWeight: 700, fontSize: "0.9375rem", marginBottom: "0.75rem" }}>Settlement Status</h2>
            {settlements.length === 0 ? (
              <p style={{ color: "var(--green)", fontWeight: 600, fontSize: "0.875rem" }}>
                ✅ Everyone is settled up!
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <p style={{ color: "var(--text-2)", fontSize: "0.8125rem" }}>
                  {settlements.length} payment{settlements.length !== 1 ? "s" : ""} needed to settle up
                </p>
                {settlements.map((s, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "0.6rem 0", borderTop: "1px solid var(--border)",
                  }}>
                    <p style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                      {s.from} → {s.to}
                    </p>
                    <p className="mono" style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--text)" }}>
                      {group.currency} {s.amount.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Member Summary */}
        <div className="card" style={{ padding: "1.25rem 1.5rem", marginBottom: "1.25rem" }}>
          <h2 style={{ fontWeight: 700, fontSize: "0.9375rem", marginBottom: "0.75rem" }}>Member Summary</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ textAlign: "left", padding: "0.5rem 0.5rem 0.5rem 0", color: "var(--text-3)", fontWeight: 600, whiteSpace: "nowrap" }}>Member</th>
                  <th style={{ textAlign: "right", padding: "0.5rem 0.5rem", color: "var(--text-3)", fontWeight: 600, whiteSpace: "nowrap" }}>Paid</th>
                  <th style={{ textAlign: "right", padding: "0.5rem 0.5rem", color: "var(--text-3)", fontWeight: 600, whiteSpace: "nowrap" }}>Owed</th>
                  <th style={{ textAlign: "right", padding: "0.5rem 0 0.5rem 0.5rem", color: "var(--text-3)", fontWeight: 600, whiteSpace: "nowrap" }}>Net</th>
                </tr>
              </thead>
              <tbody>
                {group.members.map((member) => {
                  const paid = memberPaidMap.get(member.displayName) ?? 0;
                  const owed = memberOwedMap.get(member.displayName) ?? 0;
                  const balance = adjustedBalances.find((b) => b.member === member.displayName);
                  const net = balance?.net ?? (paid - owed);
                  const isPositive = net > 0.01;
                  const isNegative = net < -0.01;
                  return (
                    <tr key={member.id} style={{ borderBottom: "1px solid var(--surface-2)" }}>
                      <td style={{ padding: "0.625rem 0.5rem 0.625rem 0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                          background: member.avatarColor ?? getAvatarColor(member.displayName),
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "var(--avatar-text)", fontSize: "0.625rem", fontWeight: 700,
                        }}>
                          {member.displayName.slice(0, 1).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600, color: "var(--text)" }}>{member.displayName}</span>
                      </td>
                      <td className="mono" style={{ textAlign: "right", padding: "0.625rem 0.5rem", fontWeight: 600, color: "var(--text)" }}>
                        {group.currency} {paid.toFixed(2)}
                      </td>
                      <td className="mono" style={{ textAlign: "right", padding: "0.625rem 0.5rem", fontWeight: 600, color: "var(--text)" }}>
                        {group.currency} {owed.toFixed(2)}
                      </td>
                      <td className="mono" style={{
                        textAlign: "right", padding: "0.625rem 0 0.625rem 0.5rem", fontWeight: 700,
                        color: isPositive ? "var(--green)" : isNegative ? "var(--red)" : "var(--text-3)",
                      }}>
                        {isPositive ? "+" : ""}{net.toFixed(2)}
                        <span style={{ fontSize: "0.625rem", marginLeft: "0.25rem", fontWeight: 500, color: "var(--text-3)" }}>
                          {isPositive ? "credit" : isNegative ? "debt" : ""}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Settlement History */}
        <div className="card" style={{ padding: "1.25rem 1.5rem", marginBottom: "1.25rem" }}>
          <h2 style={{ fontWeight: 700, fontSize: "0.9375rem", marginBottom: "0.75rem" }}>Settlement History</h2>
          {completedPayments.length === 0 ? (
            <p style={{ color: "var(--text-2)", fontSize: "0.875rem" }}>No settlements completed yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {completedPayments.map((payment) => (
                <div key={payment.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "0.75rem 0", borderBottom: "1px solid var(--border)",
                  gap: "0.75rem",
                }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                      {payment.from} → {payment.to}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.125rem" }}>
                      <span className="badge" style={{ background: "var(--green-light)", color: "var(--green)", fontSize: "0.6875rem" }}>
                        {payment.currency}
                      </span>
                      <span style={{ color: "var(--text-3)", fontSize: "0.75rem" }}>
                        {payment.settledAt ? formatDate(payment.settledAt) : ""}
                      </span>
                      {payment.batchId && (
                        <span style={{ color: "var(--text-3)", fontSize: "0.6875rem" }}>
                          Batch
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="mono" style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--text)", flexShrink: 0 }}>
                    {group.currency} {payment.amount.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity Timeline */}
        <div className="card" style={{ padding: "1.25rem 1.5rem" }}>
          <h2 style={{ fontWeight: 700, fontSize: "0.9375rem", marginBottom: "0.75rem" }}>Activity Timeline</h2>
          {activityRecords.length === 0 ? (
            <p style={{ color: "var(--text-2)", fontSize: "0.875rem" }}>No activity recorded yet.</p>
          ) : (
            <div style={{ maxHeight: 400, overflowY: "auto" }}>
              {Object.entries(groupedActivity).map(([dateLabel, records]) => (
                <section key={dateLabel} style={{ marginBottom: "1rem" }}>
                  <p style={{ color: "var(--text-3)", fontSize: "0.6875rem", fontWeight: 800, marginBottom: "0.5rem", textTransform: "uppercase" }}>
                    {dateLabel}
                  </p>
                  <div style={{ display: "grid", gap: "0.5rem" }}>
                    {records.map((record) => (
                      <div key={record.id} style={{
                        display: "flex", gap: "0.625rem", alignItems: "flex-start",
                        padding: "0.65rem", borderRadius: 8, background: "var(--surface-2)",
                      }}>
                        <div
                          style={{
                            width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                            background: activityIconBackground(record.eventType),
                            color: activityIconColor(record.eventType),
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "0.7rem", fontWeight: 900,
                          }}
                        >
                          {activityIcon(record.eventType)}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ fontWeight: 600, fontSize: "0.8125rem", color: "var(--text)" }}>
                            {record.description}
                          </p>
                          <p style={{ color: "var(--text-2)", fontSize: "0.6875rem", marginTop: "0.125rem" }}>
                            {record.actorName} · {formatDateTime(record.createdAt)}
                          </p>
                        </div>
                        <span className="badge" style={{ background: "var(--surface)", color: "var(--text-3)", fontSize: "0.625rem", flexShrink: 0 }}>
                          {activityShortType(record.eventType)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <p style={{ textAlign: "center", color: "var(--text-3)", fontSize: "0.75rem", marginTop: "2rem" }}>
          Generated by StableSplit · Report is read-only
        </p>
      </main>
  );
}
