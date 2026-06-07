"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AccordionSection from "@/components/AccordionSection";
import FloatingActionMenu from "@/components/FloatingActionMenu";
import AddExpenseModal from "@/components/AddExpenseModal";
import ConfirmModal from "@/components/ConfirmModal";
import GroupSettingsModal from "@/components/GroupSettingsModal";
import MemberWalletModal from "@/components/MemberWalletModal";
import SettlementPaymentButton from "@/components/SettlementPaymentButton";
import { useAccount } from "wagmi";
import SettleAllModal from "@/components/SettleAllModal";
import ExportModal from "@/components/ExportModal";
import { deleteExpense, deleteGroup, mapGroup, mapExpense, mapSettlementPayment, mapActivityRecord } from "@/lib/db";
import { onSnapshot, doc, collection, DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ActivityRecord, Group, Expense, Member, SettlementPayment, SettlementToken, RecurrenceFrequency } from "@/lib/types";
import { generateNextOccurrence, pauseRecurrence, resumeRecurrence, deleteRecurrence, FREQUENCY_LABELS } from "@/lib/recurrence";
import { calculateBalances, calculateSettlements, calculateNaiveSettlementCount, CATEGORY_BACKGROUNDS, CATEGORY_ICONS, normalizeExpenses } from "@/lib/calculations";
import { createSettlementKey } from "@/lib/arc-payments";
import { ARC_TESTNET_EXPLORER_URL } from "@/lib/wallet";
import { getMemberWallet, memberInitials, memberNames, shortenAddress } from "@/lib/members";

type Tab = "expenses" | "balances" | "settle" | "history";

export default function GroupPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const searchParams = useSearchParams();
  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlementPayments, setSettlementPayments] = useState<SettlementPayment[]>([]);
  const [activityRecords, setActivityRecords] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [tab, setTab] = useState<Tab>("expenses");
  const [paymentToken, setPaymentToken] = useState<SettlementToken>("USDC");
  const [showModal, setShowModal] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [showDeleteGroup, setShowDeleteGroup] = useState(false);
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null);
  const [editingWalletMember, setEditingWalletMember] = useState<Member | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [settleAllOpen, setSettleAllOpen] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const recurrenceGenerated = useRef(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [memberFilter, setMemberFilter] = useState("__all__");
  const [categoryFilter, setCategoryFilter] = useState("__all__");
  const [statusFilter, setStatusFilter] = useState<"all" | "settled" | "unsettled">("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month" | "custom">("all");
  const [customDateStart, setCustomDateStart] = useState("");
  const [customDateEnd, setCustomDateEnd] = useState("");

  const { address: connectedAddress, isConnected: isWalletConnected } = useAccount();
  const connectedMember = useMemo(() => {
    if (!connectedAddress || !group) return null;
    return group.members.find(
      (m) => m.walletAddress?.toLowerCase() === connectedAddress.toLowerCase()
    ) ?? null;
  }, [group?.members, connectedAddress]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !exp.description.toLowerCase().includes(q) &&
          !exp.paidBy.toLowerCase().includes(q) &&
          !exp.amount.toString().includes(q) &&
          !exp.category.toLowerCase().includes(q)
        )
          return false;
      }
      if (memberFilter !== "__all__" && exp.paidBy !== memberFilter) return false;
      if (categoryFilter !== "__all__" && exp.category !== categoryFilter) return false;
      if (statusFilter === "settled" && !exp.lockedAt) return false;
      if (statusFilter === "unsettled" && exp.lockedAt) return false;
      if (dateFilter !== "all") {
        const day = 86400000;
        const now = Date.now();
        if (dateFilter === "today") {
          const sod = startOfDay(now);
          if (exp.date < sod || exp.date >= sod + day) return false;
        } else if (dateFilter === "week") {
          const sow = startOfWeek(now);
          if (exp.date < sow || exp.date >= sow + 7 * day) return false;
        } else if (dateFilter === "month") {
          const som = startOfMonth(now);
          const sonm = startOfNextMonth(now);
          if (exp.date < som || exp.date >= sonm) return false;
        } else if (dateFilter === "custom" && customDateStart && customDateEnd) {
          const cs = new Date(customDateStart).getTime();
          const ce = new Date(customDateEnd).getTime() + day;
          if (exp.date < cs || exp.date > ce) return false;
        }
      }
      return true;
    });
  }, [expenses, searchQuery, memberFilter, categoryFilter, statusFilter, dateFilter, customDateStart, customDateEnd]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchQuery) count++;
    if (memberFilter !== "__all__") count++;
    if (categoryFilter !== "__all__") count++;
    if (statusFilter !== "all") count++;
    if (dateFilter !== "all") count++;
    return count;
  }, [searchQuery, memberFilter, categoryFilter, statusFilter, dateFilter]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError("");

    const unsubGroup = onSnapshot(
      doc(db, "groups", id),
      (snap) => {
        if (snap.exists()) {
          setGroup(mapGroup(snap));
        } else {
          setGroup(null);
        }
        setLoading(false);
      },
      () => {
        setError("Group could not be loaded.");
        setLoading(false);
      }
    );

    const unsubExpenses = onSnapshot(
      collection(db, "groups", id, "expenses"),
      (snap) => {
        setExpenses(snap.docs.map((d) => mapExpense(d as QueryDocumentSnapshot<DocumentData>, id)));
      }
    );

    const unsubPayments = onSnapshot(
      collection(db, "groups", id, "settlementPayments"),
      (snap) => {
        setSettlementPayments(snap.docs.map((d) => mapSettlementPayment(d as QueryDocumentSnapshot<DocumentData>)));
      }
    );

    return () => {
      unsubGroup();
      unsubExpenses();
      unsubPayments();
    };
  }, [id]);

  useEffect(() => {
    if (!successMessage) return;
    const timeout = window.setTimeout(() => setSuccessMessage(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [successMessage]);

  useEffect(() => {
    const created = searchParams.get("created");
    const demo = searchParams.get("demo");
    const joined = searchParams.get("joined");
    if (joined === "1") {
      setSuccessMessage("Successfully joined group.");
    } else if (demo === "1") {
      setSuccessMessage("Demo group generated successfully. Add expenses and try settling with Arc!");
    } else if (created === "1") {
      setSuccessMessage("Group created successfully.");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!id || !expenses.length || recurrenceGenerated.current) return;
    recurrenceGenerated.current = true;
    const due = expenses.filter(
      (exp) => exp.recurrence && !exp.recurrence.isPaused && exp.recurrence.nextDate <= Date.now()
    );
    for (const exp of due) {
      generateNextOccurrence(id, exp.id).catch(() => {});
    }
  }, [id, expenses]);

  useEffect(() => {
    if (!id || !showActivity) return;
    setActivityLoading(true);

    const unsubActivity = onSnapshot(
      collection(db, "groups", id, "activity"),
      (snap) => {
        const records = snap.docs.map((d) => mapActivityRecord(d as QueryDocumentSnapshot<DocumentData>, id));
        records.sort((a, b) => b.createdAt - a.createdAt);
        setActivityRecords(records);
        setActivityLoading(false);
      },
      () => setActivityLoading(false)
    );

    return () => unsubActivity();
  }, [id, showActivity]);

  const openActivity = () => {
    setShowActivity(true);
  };

  const avatarColor = (name: string) => {
    const colors = ["var(--avatar-1)", "var(--avatar-2)", "var(--avatar-3)", "var(--avatar-4)", "var(--avatar-5)", "var(--avatar-6)"];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const handleDeleteExpense = async () => {
    if (!deletingExpense) return;
    if (deletingExpense.lockedAt) {
      setDeletingExpense(null);
      setError("This expense is locked because it predates a completed settlement.");
      return;
    }
    const previousExpenses = expenses;
    setActionLoading(true);
    setExpenses((current) => current.filter((expense) => expense.id !== deletingExpense.id));
    try {
      await deleteExpense(id, deletingExpense.id);
      setSuccessMessage("Expense deleted successfully.");
      setDeletingExpense(null);
    } catch (e) {
      setExpenses(previousExpenses);
      setError("Failed to delete expense.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteGroup = async () => {
    setActionLoading(true);
    try {
      await deleteGroup(id);
      router.push("/");
    } catch (e) {
      setError("Failed to delete group.");
      setShowDeleteGroup(false);
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "3rem 1.5rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="card" style={{ height: 80, padding: "1.5rem" }}>
                <div style={{ background: "var(--surface-2)", borderRadius: 6, height: 16, width: "45%" }} />
              </div>
            ))}
          </div>
        </div>
    );
  }

  if (!group) {
    return (
        <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-2)" }}>
          {error || "Group not found."}{" "}
          <Link href="/" style={{ color: "var(--blue)" }}>Go home</Link>
        </div>
    );
  }

  const balances = calculateBalances(group.members, expenses);
  const settlements = calculateSettlements(balances);
  const settlementPaymentMap = new Map(
    settlementPayments.map((payment) => [payment.settlementKey, payment])
  );
  const completedPayments = settlementPayments
    .filter((payment) => payment.status === "paid" || payment.settlementStatus === "paid")
    .sort((a, b) => getPaymentDate(b) - getPaymentDate(a));

  // USD-equivalent settlement calculations (for USDC settlement)
  const usdCompletedPayments = completedPayments.filter((p) => p.currency === "USDC");
  const expensesInUsd = normalizeExpenses(expenses, "baseUsdAmount");
  const usdBalances = calculateBalances(group.members, expensesInUsd);
  const usdPaidAdjustments = new Map<string, number>();
  for (const payment of usdCompletedPayments) {
    const amt = payment.amount;
    usdPaidAdjustments.set(payment.from, (usdPaidAdjustments.get(payment.from) ?? 0) + amt);
    usdPaidAdjustments.set(payment.to, (usdPaidAdjustments.get(payment.to) ?? 0) - amt);
  }
  const usdAdjustedBalances = usdBalances.map((b) => ({
    member: b.member,
    net: b.net + (usdPaidAdjustments.get(b.member) ?? 0),
  }));
  const usdAdjustedSettlements = calculateSettlements(usdAdjustedBalances);

  // EUR-equivalent settlement calculations (for EUR settlement)
  const eurCompletedPayments = completedPayments.filter((p) => p.currency === "EUR");
  const expensesInEur = normalizeExpenses(expenses, "baseEurAmount");
  const eurBalances = calculateBalances(group.members, expensesInEur);
  const eurPaidAdjustments = new Map<string, number>();
  for (const payment of eurCompletedPayments) {
    const amt = payment.amount;
    eurPaidAdjustments.set(payment.from, (eurPaidAdjustments.get(payment.from) ?? 0) + amt);
    eurPaidAdjustments.set(payment.to, (eurPaidAdjustments.get(payment.to) ?? 0) - amt);
  }
  const eurAdjustedBalances = eurBalances.map((b) => ({
    member: b.member,
    net: b.net + (eurPaidAdjustments.get(b.member) ?? 0),
  }));
  const eurAdjustedSettlements = calculateSettlements(eurAdjustedBalances);

  // Pick settlement set matching the selected token
  const activeAdjustedSettlements = paymentToken === "USDC" ? usdAdjustedSettlements : eurAdjustedSettlements;

  const paidSettlementAdjustments = new Map<string, number>();
  for (const payment of completedPayments) {
    const amt = payment.amount;
    paidSettlementAdjustments.set(payment.from, (paidSettlementAdjustments.get(payment.from) ?? 0) + amt);
    paidSettlementAdjustments.set(payment.to, (paidSettlementAdjustments.get(payment.to) ?? 0) - amt);
  }
  const adjustedBalances = balances.map((b) => ({
    member: b.member,
    net: b.net + (paidSettlementAdjustments.get(b.member) ?? 0),
  }));
  const adjustedSettlements = calculateSettlements(adjustedBalances);
  const totalSpend = expenses.reduce((s, e) => s + e.amount, 0);
  const groupMemberNames = memberNames(group.members);
  const settleableItems = (() => {
    if (!connectedMember || activeAdjustedSettlements.length === 0) return [];
    return activeAdjustedSettlements
      .filter((s) => {
        if (s.from.toLowerCase() !== connectedMember.displayName.toLowerCase()) return false;
        const key = createSettlementKey(s, paymentToken);
        const payment = settlementPaymentMap.get(key);
        return !(payment?.status === "paid" || payment?.settlementStatus === "paid");
      })
      .map((s) => ({
        settlement: s,
        settlementKey: createSettlementKey(s, paymentToken),
        payerWallet: getMemberWallet(group.members, s.from) || group.memberWallets?.[s.from]?.trim() || "",
        receiverWallet: getMemberWallet(group.members, s.to) || group.memberWallets?.[s.to]?.trim() || "",
      }))
      .filter((item) => item.payerWallet && item.receiverWallet);
  })();
  const totalSettled = completedPayments.reduce((sum, p) => sum + p.amount, 0);
  const outstandingDebt = adjustedBalances.reduce((sum, b) => sum + Math.max(0, b.net), 0);
  const naiveCount = calculateNaiveSettlementCount(expenses);
  const optimizedCount = adjustedSettlements.length;
  const reductionPercent = naiveCount > 0 ? Math.round(((naiveCount - optimizedCount) / naiveCount) * 100) : 0;
  const totalUsdcSettled = completedPayments
    .filter((p) => p.currency === "USDC")
    .reduce((sum, p) => sum + p.amount, 0);
  const onchainTxCount = completedPayments.filter((p) => p.txHash).length;
  const batchCount = new Set(completedPayments.filter((p) => p.batchId).map((p) => p.batchId)).size;
  const walletLinkedMembers = group.members.filter(
    (m) => m.walletAddress || group.memberWallets?.[m.displayName]
  ).length;
  const txAvoided = naiveCount - optimizedCount;
  const memberPaidMap = new Map<string, number>();
  const memberOwedMap = new Map<string, number>();
  for (const exp of expenses) {
    memberPaidMap.set(exp.paidBy, (memberPaidMap.get(exp.paidBy) ?? 0) + exp.amount);
    for (const name of exp.splitAmong) {
      memberOwedMap.set(name, (memberOwedMap.get(name) ?? 0) + (exp.amount / exp.splitAmong.length));
    }
  }

  return (
    <>
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>
        {/* Back */}
        <Link href="/" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.375rem", color: "var(--text-2)", fontSize: "0.875rem", marginBottom: "1.5rem", fontWeight: 500 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          All Groups
        </Link>

        {/* Group Header */}
        <div className="card animate-fade-in" style={{ padding: "1.75rem", marginBottom: "1.25rem" }}>
          <div className="group-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
            <div className="group-title-row" style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
              <div
                style={{
                  width: 52, height: 52,
                  borderRadius: 14, flexShrink: 0,
                  overflow: "hidden",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {group.photoURL ? (
                  <img src={group.photoURL} alt={group.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{
                    width: "100%", height: "100%",
                    background: avatarColor(group.name),
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "var(--avatar-text)", fontWeight: 700, fontSize: "1.125rem",
                  }}>
                    {group.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <h1 style={{ fontSize: "1.375rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "0.125rem" }}>
                  {group.name}
                  {group.isDemo && (
                    <span
                      className="badge"
                      style={{ marginLeft: "0.625rem", background: "var(--blue-light)", color: "var(--blue)", fontWeight: 600, verticalAlign: "middle", fontSize: "0.75rem" }}
                    >
                      🏷 Demo Group
                    </span>
                  )}
                </h1>
                {group.description && (
                  <p style={{ color: "var(--text-2)", fontSize: "0.875rem" }}>{group.description}</p>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button
                onClick={openActivity}
                className="btn-secondary"
                title="View group activity"
                style={{ padding: "0.625rem 0.8rem" }}
              >
                Activity
              </button>
            </div>
          </div>

          {(successMessage || error) && (
            <div
              aria-live="polite"
              style={{
                marginTop: "1rem",
                padding: "0.75rem 1rem",
                background: successMessage ? "var(--green-light)" : "var(--red-light)",
                border: `1px solid ${successMessage ? "var(--success-border)" : "var(--error-border)"}`,
                borderRadius: 8,
                fontSize: "0.8125rem",
                color: successMessage ? "var(--green)" : "var(--red)",
                fontWeight: 600,
              }}
            >
              {successMessage || error}
            </div>
          )}

          {/* Stats */}
          <div
            className="group-stats-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "1rem",
              marginTop: "1.5rem",
              padding: "1.25rem",
              background: "var(--surface-2)",
              borderRadius: 10,
            }}
          >
            {[
              { label: "Total Spent", value: `${group.currency} ${totalSpend.toFixed(2)}` },
              { label: "Expenses", value: expenses.length },
              { label: "Members", value: group.members.length },
            ].map((s) => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div className="mono" style={{ fontWeight: 700, fontSize: "1.125rem", letterSpacing: "-0.02em" }}>{s.value}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-2)", marginTop: "0.125rem", fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Members row */}
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem", flexWrap: "wrap" }}>
            {group.members.map((m) => {
              const wallet = getMemberWallet(group.members, m.displayName);
              return (
              <div
                key={m.id}
                style={{
                  display: "flex", alignItems: "center", gap: "0.375rem",
                  padding: "0.25rem 0.625rem 0.25rem 0.375rem",
                  background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: 999,
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: "50%",
                  background: m.avatarColor ?? avatarColor(m.displayName),
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--avatar-text)", fontSize: "0.5625rem", fontWeight: 700,
                }}>
                  {memberInitials(m).slice(0, 1)}
                </div>
                <span style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{m.displayName}</span>
                {wallet && (
                  <span className="mono" title={wallet} style={{ fontSize: "0.6875rem", color: "var(--green)", fontWeight: 700 }}>
                    {shortenAddress(wallet)}
                  </span>
                )}
                {!wallet && (
                  <span style={{ fontSize: "0.6875rem", color: "var(--red)", fontWeight: 700 }}>
                    No wallet
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setEditingWalletMember(m)}
                  className="btn-secondary"
                  style={{ padding: "0.25rem 0.45rem", fontSize: "0.6875rem", borderRadius: 999 }}
                >
                  {wallet ? "Edit Wallet" : "Add Wallet"}
                </button>
              </div>
              );
            })}
          </div>
        </div>

        {/* Settlement Dashboard */}
        {expenses.length > 0 ? (
          <AccordionSection
            title="Settlement Dashboard"
            subtitle="Overview of group spending and balances"
            defaultExpanded={true}
            badge={null}
          >
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "0.75rem",
            }}>
              {[
                { label: "Total Expenses", value: `${group.currency} ${totalSpend.toFixed(2)}` },
                { label: "Total Settled", value: `${group.currency} ${totalSettled.toFixed(2)}`, color: "var(--green)" },
                { label: "Outstanding Debt", value: `${group.currency} ${outstandingDebt.toFixed(2)}`, color: outstandingDebt > 0.01 ? "var(--red)" : "var(--green)" },
                { label: "Members", value: group.members.length },
                { label: "Expenses", value: expenses.length },
                { label: "Settlements", value: completedPayments.length },
              ].map((stat) => (
                <div key={stat.label} style={{
                  padding: "0.75rem", borderRadius: 8, background: "var(--surface-2)",
                  textAlign: "center",
                }}>
                  <div className="mono" style={{ fontWeight: 700, fontSize: "0.9375rem", color: stat.color ?? "var(--text)" }}>
                    {stat.value}
                    {stat.label === "Outstanding Debt" && Math.abs(outstandingDebt) < 0.01 && (
                      <span style={{ color: "var(--green)", fontWeight: 600 }}> 0.00</span>
                    )}
                  </div>
                  <div style={{ fontSize: "0.6875rem", color: "var(--text-3)", marginTop: "0.125rem", fontWeight: 600 }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </AccordionSection>
        ) : (
          <AccordionSection
            title="Getting Started"
            subtitle="Add your first expense to see the dashboard"
            defaultExpanded={true}
          >
            <div style={{ textAlign: "center", padding: "0.5rem 0" }}>
              <p style={{ color: "var(--text-2)", fontSize: "0.875rem", marginBottom: "1rem", maxWidth: 320, marginLeft: "auto", marginRight: "auto" }}>
                Add your first expense to see the dashboard, balances, and settlement options.
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="btn-primary"
                style={{ fontSize: "0.875rem" }}
              >
                + Add Expense
              </button>
            </div>
          </AccordionSection>
        )}

        {/* Tabs */}
        <div
          style={{
            display: "flex", gap: "0.25rem",
            background: "var(--surface-2)",
            padding: "0.25rem",
            borderRadius: 10,
            marginBottom: "1.25rem",
            border: "1px solid var(--border)",
            position: "sticky",
            top: 76,
            zIndex: 40,
          }}
        >
          {(["expenses", "balances", "settle", "history"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: "0.5rem",
                borderRadius: 7,
                border: "none",
                background: tab === t ? "var(--surface)" : "transparent",
                color: tab === t ? "var(--text)" : "var(--text-2)",
                fontWeight: tab === t ? 600 : 400,
                fontSize: "0.875rem",
                cursor: "pointer",
                transition: "all 0.15s",
                boxShadow: tab === t ? "var(--shadow-sm)" : "none",
                fontFamily: "DM Sans, sans-serif",
                textTransform: "capitalize",
              }}
            >
              {t === "settle" ? "Settle Up" : t === "history" ? "Payment History" : t.charAt(0).toUpperCase() + t.slice(1)}
              {t === "expenses" && expenses.length > 0 && (
                <span
                  style={{
                    marginLeft: "0.375rem",
                    padding: "0.0625rem 0.4rem",
                    background: "var(--blue-light)",
                    color: "var(--blue)",
                    borderRadius: 999,
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                  }}
                >
                  {expenses.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab: Expenses */}
        {tab === "expenses" && (
          <div className="stagger-children" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {/* Search + Filters */}
            <div className="card" style={{ padding: "1rem 1.25rem" }}>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "var(--text-3)", pointerEvents: "none" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input
                    type="text"
                    placeholder="Search expenses..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.5rem 2rem",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                      color: "var(--text)",
                      fontSize: "0.875rem",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      style={{
                        position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                        background: "none", border: "none", cursor: "pointer", color: "var(--text-3)",
                        fontSize: "1rem", lineHeight: 1, padding: "2px 4px",
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="btn-secondary"
                  style={{ padding: "0.5rem 0.75rem", fontSize: "0.8125rem", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "0.375rem" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="20" y2="12"/><line x1="12" y1="18" x2="20" y2="18"/></svg>
                  Filters
                  {activeFilterCount > 0 && (
                    <span style={{
                      background: "var(--blue)", color: "#fff", borderRadius: 999,
                      fontSize: "0.6875rem", fontWeight: 700, padding: "1px 6px", lineHeight: "1.25rem",
                    }}>
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </div>

              {showFilters && (
                <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                  <div>
                    <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.375rem" }}>Member</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                      {[
                        { label: "All Members", value: "__all__" },
                        ...(group?.members.map((m) => ({ label: m.displayName, value: m.displayName })) ?? []),
                      ].map((opt) => (
                        <button key={opt.value} type="button" onClick={() => setMemberFilter(opt.value)}
                          style={{
                            padding: "0.3rem 0.7rem", borderRadius: 999, fontSize: "0.8125rem", whiteSpace: "nowrap",
                            fontWeight: memberFilter === opt.value ? 600 : 400,
                            background: memberFilter === opt.value ? "var(--blue)" : "var(--surface-2)",
                            color: memberFilter === opt.value ? "#fff" : "var(--text)",
                            border: "none", cursor: "pointer", transition: "all 0.15s",
                          }}
                        >{opt.label}</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.375rem" }}>Category</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                      {[
                        { label: "All Categories", value: "__all__" },
                        ...Object.keys(CATEGORY_ICONS).map((cat) => ({
                          label: `${CATEGORY_ICONS[cat]} ${cat.charAt(0).toUpperCase() + cat.slice(1)}`,
                          value: cat,
                        })),
                      ].map((opt) => (
                        <button key={opt.value} type="button" onClick={() => setCategoryFilter(opt.value)}
                          style={{
                            padding: "0.3rem 0.7rem", borderRadius: 999, fontSize: "0.8125rem", whiteSpace: "nowrap",
                            fontWeight: categoryFilter === opt.value ? 600 : 400,
                            background: categoryFilter === opt.value ? "var(--blue)" : "var(--surface-2)",
                            color: categoryFilter === opt.value ? "#fff" : "var(--text)",
                            border: "none", cursor: "pointer", transition: "all 0.15s",
                          }}
                        >{opt.label}</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.375rem" }}>Status</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                      {[
                        { label: "All", value: "all" },
                        { label: "Settled", value: "settled" },
                        { label: "Unsettled", value: "unsettled" },
                      ].map((opt) => (
                        <button key={opt.value} type="button" onClick={() => setStatusFilter(opt.value as typeof statusFilter)}
                          style={{
                            padding: "0.3rem 0.7rem", borderRadius: 999, fontSize: "0.8125rem", whiteSpace: "nowrap",
                            fontWeight: statusFilter === opt.value ? 600 : 400,
                            background: statusFilter === opt.value ? "var(--blue)" : "var(--surface-2)",
                            color: statusFilter === opt.value ? "#fff" : "var(--text)",
                            border: "none", cursor: "pointer", transition: "all 0.15s",
                          }}
                        >{opt.label}</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.375rem" }}>Date</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                      {[
                        { label: "All", value: "all" },
                        { label: "Today", value: "today" },
                        { label: "This Week", value: "week" },
                        { label: "This Month", value: "month" },
                        { label: "Custom", value: "custom" },
                      ].map((opt) => (
                        <button key={opt.value} type="button" onClick={() => {
                          setDateFilter(opt.value as typeof dateFilter);
                          if (opt.value !== "custom") { setCustomDateStart(""); setCustomDateEnd(""); }
                        }}
                          style={{
                            padding: "0.3rem 0.7rem", borderRadius: 999, fontSize: "0.8125rem", whiteSpace: "nowrap",
                            fontWeight: dateFilter === opt.value ? 600 : 400,
                            background: dateFilter === opt.value ? "var(--blue)" : "var(--surface-2)",
                            color: dateFilter === opt.value ? "#fff" : "var(--text)",
                            border: "none", cursor: "pointer", transition: "all 0.15s",
                          }}
                        >{opt.label}</button>
                      ))}
                    </div>
                    {dateFilter === "custom" && (
                      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                        <input type="date" value={customDateStart} onChange={(e) => setCustomDateStart(e.target.value)}
                          style={{ padding: "0.375rem 0.625rem", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: "0.8125rem" }}
                        />
                        <span style={{ color: "var(--text-3)", alignSelf: "center" }}>→</span>
                        <input type="date" value={customDateEnd} onChange={(e) => setCustomDateEnd(e.target.value)}
                          style={{ padding: "0.375rem 0.625rem", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: "0.8125rem" }}
                        />
                      </div>
                    )}
                  </div>

                  {activeFilterCount > 0 && (
                    <button onClick={() => { setSearchQuery(""); setMemberFilter("__all__"); setCategoryFilter("__all__"); setStatusFilter("all"); setDateFilter("all"); setCustomDateStart(""); setCustomDateEnd(""); }}
                      style={{ alignSelf: "flex-start", fontSize: "0.8125rem", color: "var(--blue)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    >Clear all filters</button>
                  )}
                </div>
              )}
            </div>

            {expenses.length === 0 ? (
              <div
                className="card"
                style={{ padding: "3rem 2rem", textAlign: "center" }}
              >
                <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>💸</div>
                <p style={{ fontWeight: 600, marginBottom: "0.25rem" }}>No expenses yet</p>
                <p style={{ color: "var(--text-2)", fontSize: "0.875rem", marginBottom: "1rem" }}>
                  Add the first one to get started.
                </p>
                <button
                  onClick={() => setShowModal(true)}
                  className="btn-primary"
                  style={{ fontSize: "0.875rem" }}
                >
                  + Add Expense
                </button>
              </div>
            ) : (
              <>
                {activeFilterCount > 0 && (
                  <p style={{ fontSize: "0.8125rem", color: "var(--text-3)", textAlign: "center" }}>
                    Showing {filteredExpenses.length} of {expenses.length} expenses
                  </p>
                )}
                {filteredExpenses.length === 0 ? (
                  <div className="card animate-fade-in" style={{ padding: "3rem 2rem", textAlign: "center" }}>
                    <p style={{ color: "var(--text-2)", fontSize: "0.875rem" }}>No expenses match your filters.</p>
                  </div>
                ) : (
                  filteredExpenses.map((exp) => {
                const locked = Boolean(exp.lockedAt);
                return (
                <div key={exp.id} className="card" style={{ padding: "1.25rem 1.5rem", opacity: locked ? 0.92 : 1 }}>
                  <div className="expense-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", gap: "0.875rem", alignItems: "flex-start" }}>
                      <div
                        style={{
                          width: 38, height: 38,
                          borderRadius: 10,
                          background: CATEGORY_BACKGROUNDS[exp.category],
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "1rem",
                          flexShrink: 0,
                        }}
                      >
                        {CATEGORY_ICONS[exp.category]}
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                          <p style={{ fontWeight: 600, fontSize: "0.9375rem", letterSpacing: "-0.01em" }}>
                            {exp.description}
                          </p>
                          {locked && (
                            <span
                              className="badge"
                              title="This expense is locked because it existed before a completed settlement. Create a new expense for later changes."
                              style={{ background: "var(--surface-2)", color: "var(--text-2)" }}
                            >
                              Lock
                            </span>
                          )}
                          {exp.recurrence && (
                            <span
                              className="badge"
                              title={exp.recurrence.isPaused ? "Recurrence is paused" : `Repeats ${FREQUENCY_LABELS[exp.recurrence.frequency].toLowerCase()}`}
                              style={{
                                background: exp.recurrence.isPaused ? "var(--surface-2)" : "var(--blue-light)",
                                color: exp.recurrence.isPaused ? "var(--text-2)" : "var(--blue)",
                              }}
                            >
                              {exp.recurrence.isPaused ? `${FREQUENCY_LABELS[exp.recurrence.frequency]} (paused)` : FREQUENCY_LABELS[exp.recurrence.frequency]}
                            </span>
                          )}
                          {exp.recurrenceParentId && (
                            <span className="badge" style={{ background: "var(--surface-2)", color: "var(--text-3)" }}>
                              Recurring
                            </span>
                          )}
                        </div>
                        <p style={{ color: "var(--text-2)", fontSize: "0.8125rem", marginTop: "0.125rem" }}>
                          Paid by <strong style={{ color: "var(--text)" }}>{exp.paidBy}</strong>
                          {" · "}
                          Split: {exp.splitAmong.join(", ")}
                        </p>
                        {exp.notes && (
                          <p style={{ color: "var(--text-2)", fontSize: "0.8125rem", marginTop: "0.25rem" }}>
                            {exp.notes}
                          </p>
                        )}
                        <p style={{ color: "var(--text-3)", fontSize: "0.75rem", marginTop: "0.25rem" }}>
                          {new Date(exp.date).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                          })}
                          {locked && exp.lockedAt ? ` · Locked ${new Date(exp.lockedAt).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                          })}` : ""}
                        </p>
                      </div>
                    </div>
                  <div className="expense-amount" style={{ textAlign: "right", flexShrink: 0 }}>
                      <div className="mono" style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text)" }}>
                        {exp.originalCurrency ?? group.currency} {exp.amount.toFixed(2)}
                      </div>
                      {exp.originalCurrency && exp.baseUsdAmount != null && (
                        <div style={{ fontSize: "0.7rem", color: "var(--text-3)", marginTop: "0.125rem", lineHeight: 1.3 }}>
                          USD {exp.baseUsdAmount.toFixed(2)}
                        </div>
                      )}
                      {exp.originalCurrency && exp.baseEurAmount != null && (
                        <div style={{ fontSize: "0.7rem", color: "var(--text-3)", lineHeight: 1.3 }}>
                          EUR {exp.baseEurAmount.toFixed(2)}
                        </div>
                      )}
                      <div style={{ fontSize: "0.75rem", color: "var(--text-3)", marginTop: "0.125rem" }}>
                        {group.currency} {(exp.amount / exp.splitAmong.length).toFixed(2)}/ea
                      </div>
                      {!locked && (
                      <div style={{ display: "flex", gap: "0.375rem", justifyContent: "flex-end", marginTop: "0.75rem", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => setViewingExpense(exp)}
                          className="btn-secondary"
                          title="View expense"
                          style={{ padding: "0.35rem 0.55rem", fontSize: "0.75rem" }}
                        >
                          View
                        </button>
                        {exp.recurrence && !exp.recurrence.isPaused && (
                          <button
                            type="button"
                            onClick={() => pauseRecurrence(id, exp.id)}
                            className="btn-secondary"
                            title="Pause recurrence"
                            style={{ padding: "0.35rem 0.55rem", fontSize: "0.75rem" }}
                          >
                            ⏸
                          </button>
                        )}
                        {exp.recurrence && exp.recurrence.isPaused && (
                          <button
                            type="button"
                            onClick={() => resumeRecurrence(id, exp.id)}
                            className="btn-secondary"
                            title="Resume recurrence"
                            style={{ padding: "0.35rem 0.55rem", fontSize: "0.75rem" }}
                          >
                            ▶
                          </button>
                        )}
                        {exp.recurrence && (
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteRecurrence(id, exp.id);
                              setSuccessMessage("Recurrence cancelled.");
                            }}
                            className="btn-secondary"
                            title="Delete recurrence"
                            style={{ padding: "0.35rem 0.55rem", fontSize: "0.75rem", color: "var(--red)" }}
                          >
                            🚫
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDeletingExpense(exp)}
                          className="btn-secondary"
                          title="Delete expense"
                          style={{ padding: "0.35rem 0.55rem", fontSize: "0.75rem", color: "var(--red)" }}
                        >
                          🗑
                        </button>
                      </div>
                      )}
                      {locked && (
                        <div style={{ display: "flex", gap: "0.375rem", justifyContent: "flex-end", marginTop: "0.75rem" }}>
                          <button
                            type="button"
                            onClick={() => setViewingExpense(exp)}
                            className="btn-secondary"
                            title="View expense"
                            style={{ padding: "0.35rem 0.55rem", fontSize: "0.75rem" }}
                          >
                            View
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                );
              })
                )}
              </>
            )}
          </div>
        )}

        {/* Tab: Balances */}
        {tab === "balances" && (
          <div className="stagger-children" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {expenses.length === 0 ? (
              <div className="card animate-fade-in" style={{ padding: "3rem 2rem", textAlign: "center" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>◎</div>
                <p style={{ fontWeight: 600, marginBottom: "0.25rem" }}>No balances yet</p>
                <p style={{ color: "var(--text-2)", fontSize: "0.875rem" }}>
                  Add an expense and balances will appear here automatically.
                </p>
              </div>
            ) : adjustedBalances.map((b) => {
              const isPositive = b.net > 0.01;
              const isNegative = b.net < -0.01;
              const isZero = !isPositive && !isNegative;
              return (
                <div key={b.member} className="card" style={{ padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: avatarColor(b.member),
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "var(--avatar-text)", fontWeight: 700,
                  }}>
                    {b.member.slice(0, 1).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600 }}>{b.member}</p>
                    <p style={{
                      fontSize: "0.8125rem",
                      color: isPositive ? "var(--green)" : isNegative ? "var(--red)" : "var(--text-3)",
                      fontWeight: 500,
                    }}>
                      {isZero ? "All settled up" : isPositive ? "is owed money" : "owes money"}
                    </p>
                  </div>
                  <div className="mono" style={{
                    fontWeight: 700, fontSize: "1rem",
                    color: isPositive ? "var(--green)" : isNegative ? "var(--red)" : "var(--text-3)",
                  }}>
                    {isPositive ? "+" : ""}{b.net.toFixed(2)} {group.currency}
                    {(() => {
                      const usdB = usdAdjustedBalances.find((u) => u.member === b.member);
                      if (!usdB || Math.abs(usdB.net) < 0.01) return null;
                      const sign = usdB.net >= 0 ? "+" : "";
                      return (
                        <div style={{ fontSize: "0.75rem", fontWeight: 600, color: isPositive ? "var(--green)" : isNegative ? "var(--red)" : "var(--text-3)", opacity: 0.8 }}>
                          (~{sign}{usdB.net.toFixed(2)} USDC)
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab: Settle Up */}
        {tab === "settle" && (
          <div>
            {expenses.length === 0 ? (
              <div className="card animate-fade-in" style={{ padding: "3rem 2rem", textAlign: "center" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>↔</div>
                <p style={{ fontWeight: 600, marginBottom: "0.25rem" }}>Nothing to settle yet</p>
                <p style={{ color: "var(--text-2)", fontSize: "0.875rem" }}>
                  Add an expense first, then settlements will appear here automatically.
                </p>
              </div>
            ) : activeAdjustedSettlements.length === 0 ? (
              <div className="card animate-fade-in" style={{ padding: "3rem 2rem", textAlign: "center" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>✅</div>
                <p style={{ fontWeight: 600, marginBottom: "0.25rem" }}>All settled!</p>
                <p style={{ color: "var(--text-2)", fontSize: "0.875rem" }}>
                  Everyone's balances are clear. Nothing to pay.
                </p>
              </div>
            ) : (
              <div className="stagger-children" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                  <p style={{ fontSize: "0.875rem", color: "var(--text-2)", marginBottom: "0.25rem", fontWeight: 500 }}>
                    {activeAdjustedSettlements.length} payment{activeAdjustedSettlements.length !== 1 ? "s" : ""} needed to settle up
                    {naiveCount > 0 && optimizedCount < naiveCount && (
                      <span style={{ fontSize: "0.75rem", marginLeft: "0.5rem", color: "var(--green)", fontWeight: 600 }}>
                        ({reductionPercent}% fewer than {naiveCount} without netting)
                      </span>
                    )}
                  </p>
                  <div style={{ display: "flex", gap: "0.35rem", background: "var(--surface-2)", padding: "0.25rem", borderRadius: 8, border: "1px solid var(--border)" }}>
                    {(["USDC", "EUR"] as SettlementToken[]).map((token) => (
                      <button
                        key={token}
                        type="button"
                        onClick={() => setPaymentToken(token)}
                        style={{
                          border: "none",
                          borderRadius: 6,
                          padding: "0.35rem 0.65rem",
                          background: paymentToken === token ? "var(--surface)" : "transparent",
                          color: paymentToken === token ? "var(--text)" : "var(--text-2)",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          fontFamily: "DM Sans, sans-serif",
                        }}
                      >
                        {token}
                      </button>
                    ))}
                  </div>
                  {settleableItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSettleAllOpen(true)}
                      className="btn-primary"
                      style={{ padding: "0.5rem 0.9rem", fontSize: "0.8125rem" }}
                    >
                      Settle All ({settleableItems.length})
                    </button>
                  )}
                </div>
                {activeAdjustedSettlements.map((s, i) => {
                  const payment = settlementPaymentMap.get(createSettlementKey(s, paymentToken));
                  const paid = payment?.status === "paid" || payment?.settlementStatus === "paid";
                  const paidToken = payment?.settlementTokenUsed ?? payment?.currency;
                  return (
                  <div key={i} className="card" style={{ padding: "1.25rem 1.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                      {/* From */}
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: "50%",
                          background: avatarColor(s.from),
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "var(--avatar-text)", fontWeight: 700, fontSize: "0.8125rem",
                        }}>
                          {s.from.slice(0, 1).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600 }}>{s.from}</span>
                        <WalletBadge wallet={getMemberWallet(group.members, s.from)} />
                        {!getMemberWallet(group.members, s.from) && (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => {
                              const member = group.members.find((existing) => existing.displayName === s.from);
                              if (member) setEditingWalletMember(member);
                            }}
                            style={{ padding: "0.35rem 0.55rem", fontSize: "0.75rem" }}
                          >
                            Add Wallet
                          </button>
                        )}
                      </div>

                      {/* Arrow + amount */}
                      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 120, justifyContent: "center" }}>
                        <div style={{ height: 1.5, flex: 1, background: "var(--border)" }} />
                        <div style={{
                          padding: "0.25rem 0.75rem",
                          background: "var(--blue-light)",
                          border: "1.5px solid var(--blue-mid)",
                          borderRadius: 8,
                          whiteSpace: "nowrap",
                        }}>
                          <span className="mono" style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--blue)" }}>
                            {paymentToken} {s.amount.toFixed(2)}
                          </span>
                        </div>
                        <div style={{ height: 1.5, flex: 1, background: "var(--border)" }} />
                      </div>

                      {/* To */}
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: "50%",
                          background: avatarColor(s.to),
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "var(--avatar-text)", fontWeight: 700, fontSize: "0.8125rem",
                        }}>
                          {s.to.slice(0, 1).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600 }}>{s.to}</span>
                        <WalletBadge wallet={getMemberWallet(group.members, s.to)} />
                        {!getMemberWallet(group.members, s.to) && (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => {
                              const member = group.members.find((existing) => existing.displayName === s.to);
                              if (member) setEditingWalletMember(member);
                            }}
                            style={{ padding: "0.35rem 0.55rem", fontSize: "0.75rem" }}
                          >
                            Add Wallet
                          </button>
                        )}
                      </div>
                    </div>
                    <p style={{ fontSize: "0.8125rem", color: "var(--text-2)", marginTop: "0.75rem", textAlign: "center" }}>
                      <strong style={{ color: "var(--text)" }}>{s.from}</strong> pays{" "}
                      <strong style={{ color: "var(--text)" }}>{s.to}</strong>{" "}
                       <span className="mono" style={{ color: "var(--blue)", fontWeight: 700 }}>
                        {paymentToken} {s.amount.toFixed(2)}
                      </span>
                    </p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", marginTop: "1rem", flexWrap: "wrap" }}>
                      <span
                        className="badge"
                        style={{
                          background: paid ? "var(--green-light)" : "var(--surface-2)",
                          color: paid ? "var(--green)" : "var(--text-2)",
                        }}
                      >
                        {paid ? `Paid via ${paidToken}` : payment?.status ?? payment?.settlementStatus ?? "unpaid"}
                      </span>
                      {paid && payment?.txHash && (
                        <a
                          className="mono"
                          href={`${ARC_TESTNET_EXPLORER_URL}/tx/${payment.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          title={payment.txHash}
                          style={{ fontSize: "0.75rem", color: "var(--blue)", fontWeight: 700, textDecoration: "none" }}
                        >
                          Tx {shortenHash(payment.txHash)}
                        </a>
                      )}
                      <SettlementPaymentButton
                        group={group}
                        groupId={id}
                        settlement={s}
                        payment={payment}
                        token={paymentToken}
                        onStatus={(message, kind = "success") => {
                          if (kind === "error") {
                            setError(message);
                            setSuccessMessage("");
                          } else {
                            setSuccessMessage(message);
                            setError("");
                          }
                        }}
                        onPaid={() => {}}
                      />
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab: History */}
        {tab === "history" && (
          <div className="stagger-children" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {completedPayments.length === 0 ? (
              <div className="card animate-fade-in" style={{ padding: "3rem 2rem", textAlign: "center" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>📋</div>
                <p style={{ fontWeight: 600, marginBottom: "0.25rem" }}>No payment history yet</p>
                <p style={{ color: "var(--text-2)", fontSize: "0.875rem" }}>
                  Settlements confirmed on Arc will show up here automatically.
                </p>
              </div>
            ) : (
              <BatchHistoryRenderer payments={completedPayments} group={group} />
            )}
          </div>
        )}


      </main>

      {showModal && (
        <AddExpenseModal
          groupId={id}
          members={groupMemberNames}
          currency={group.currency}
          onClose={() => setShowModal(false)}
          onAdded={() => {
            setShowModal(false);
            setSuccessMessage("Expense added successfully.");
          }}
        />
      )}
      {showActivity && (
        <ActivityPanel
          activity={activityRecords}
          loading={activityLoading}
          onClose={() => setShowActivity(false)}
        />
      )}
      {viewingExpense && (
        <ExpenseDetailsModal
          expense={viewingExpense}
          currency={group.currency}
          onClose={() => setViewingExpense(null)}
        />
      )}
      {showGroupSettings && (
        <GroupSettingsModal
          group={group}
          balances={adjustedBalances}
          onClose={() => setShowGroupSettings(false)}
          onSaved={(updatedGroup) => {
            setGroup(updatedGroup);
            setSuccessMessage("Group updated successfully.");
          }}
        />
      )}
      {editingWalletMember && (
        <MemberWalletModal
          group={group}
          member={editingWalletMember}
          onClose={() => setEditingWalletMember(null)}
          onSaved={(updatedGroup) => {
            setGroup(updatedGroup);
            const updatedMember = updatedGroup.members.find((member) => member.id === editingWalletMember.id);
            if (updatedMember) setEditingWalletMember(updatedMember);
            setSuccessMessage("Wallet saved successfully.");
          }}
        />
      )}
      {showDeleteGroup && (
        <ConfirmModal
          title="Delete this group?"
          message="This permanently deletes the group and all related expenses. This cannot be undone."
          confirmLabel="Delete Group"
          danger
          loading={actionLoading}
          onCancel={() => setShowDeleteGroup(false)}
          onConfirm={handleDeleteGroup}
        />
      )}
      {deletingExpense && (
        <ConfirmModal
          title="Delete this expense?"
          message={`Delete "${deletingExpense.description}"? Balances will update immediately after deletion.`}
          confirmLabel="Delete Expense"
          danger
          loading={actionLoading}
          onCancel={() => setDeletingExpense(null)}
          onConfirm={handleDeleteExpense}
        />
      )}
      {settleAllOpen && (
        <SettleAllModal
          group={group}
          groupId={id}
          items={settleableItems}
          token={paymentToken}
          onClose={() => setSettleAllOpen(false)}
          onComplete={() => setSettleAllOpen(false)}
          onStatus={(message, kind) => {
            if (kind === "error") { setError(message); setSuccessMessage(""); }
            else { setSuccessMessage(message); setError(""); }
          }}
        />
      )}
      {showExportModal && (
        <ExportModal
          group={group}
          expenses={expenses}
          settlementPayments={settlementPayments}
          activityRecords={activityRecords}
          members={group.members}
          balances={adjustedBalances}
          settlements={adjustedSettlements}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {/* Floating Action Menu */}
      {group && (
        <FloatingActionMenu
          actions={[
            {
              id: "add-expense",
              label: "Add Expense",
              icon: "+",
              onClick: () => setShowModal(true),
            },
            {
              id: "invite",
              label: "Invite Members",
              icon: "\u{1F517}",
              onClick: () => {
                const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
                const inviteUrl = "${baseUrl}/join/${group.inviteCode}";
                navigator.clipboard.writeText(inviteUrl).then(() => {
                  setInviteCopied(true);
                  setSuccessMessage("Invite link copied to clipboard!");
                  setTimeout(() => setInviteCopied(false), 2000);
                }).catch(() => {});
              },
              color: "var(--green)",
            },
            {
              id: "export",
              label: "Export Data",
              icon: "\u{1F4E5}",
              onClick: () => setShowExportModal(true),
            },
            {
              id: "edit",
              label: "Edit Group",
              icon: "\u{270E}",
              onClick: () => setShowGroupSettings(true),
            },
            {
              id: "delete",
              label: "Delete Group",
              icon: "\u{1F5D1}",
              onClick: () => setShowDeleteGroup(true),
              color: "var(--red)",
            },
          ]}
        />
      )}
    </>
  );
}

function WalletBadge({ wallet }: { wallet: string }) {
  const copyWallet = async () => {
    if (!wallet) return;
    await navigator.clipboard?.writeText(wallet);
  };

  if (!wallet) {
    return (
      <span className="badge" style={{ background: "var(--red-light)", color: "var(--red)" }}>
        No wallet
      </span>
    );
  }

  return (
    <span className="badge mono" title={wallet} style={{ background: "var(--green-light)", color: "var(--green)", gap: "0.35rem" }}>
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

function ExpenseDetailsModal({ expense, currency, onClose }: { expense: Expense; currency: string; onClose: () => void }) {
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
        <div
          className="animate-scale-in"
          style={{
            width: "min(480px, 100%)",
            background: "var(--surface)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-lg)",
            overflow: "hidden",
            pointerEvents: "auto",
          }}
        >
          <div style={{ padding: "1.5rem 1.75rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", gap: "1rem" }}>
            <div>
              <h2 style={{ fontWeight: 700, fontSize: "1.125rem", letterSpacing: "-0.02em" }}>{expense.description}</h2>
              <p style={{ color: "var(--text-2)", fontSize: "0.8125rem", marginTop: "0.125rem" }}>
                Expense details
              </p>
            </div>
            <button type="button" onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--border)", cursor: "pointer", color: "var(--text-2)", fontSize: "1.25rem", lineHeight: 1, flexShrink: 0 }}>
              ×
            </button>
          </div>
          <div style={{ padding: "1.5rem 1.75rem", display: "grid", gap: "0.85rem" }}>
            <DetailRow label="Amount" value={`${expense.originalCurrency ?? currency} ${expense.amount.toFixed(2)}`} mono />
            {expense.originalCurrency && expense.baseUsdAmount != null && (
              <DetailRow label="USD equivalent" value={`USD ${expense.baseUsdAmount.toFixed(2)}`} mono />
            )}
            {expense.originalCurrency && expense.baseEurAmount != null && (
              <DetailRow label="EUR equivalent" value={`EUR ${expense.baseEurAmount.toFixed(2)}`} mono />
            )}
            <DetailRow label="Paid by" value={expense.paidBy} />
            <DetailRow label="Split among" value={expense.splitAmong.join(", ")} />
            <DetailRow label="Date" value={formatDateTime(expense.date)} />
            <DetailRow label="Category" value={expense.category} />
            {expense.notes && <DetailRow label="Notes" value={expense.notes} />}
            {expense.lockedAt && <DetailRow label="Lock status" value={`Locked ${formatDateTime(expense.lockedAt)}`} />}
          </div>
          <div style={{ padding: "1.25rem 1.75rem", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} className="btn-secondary">Close</button>
          </div>
        </div>
      </div>
    </>
  );
}

function ActivityPanel({
  activity,
  loading,
  onClose,
}: {
  activity: ActivityRecord[];
  loading: boolean;
  onClose: () => void;
}) {
  const grouped = groupActivityByDate(activity);

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
      <aside
        className="animate-slide-in"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 101,
          width: "min(440px, 100vw)",
          background: "var(--surface)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "var(--shadow-lg)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
          <div>
            <h2 style={{ fontWeight: 700, fontSize: "1.125rem", letterSpacing: "-0.02em" }}>Activity</h2>
            <p style={{ color: "var(--text-2)", fontSize: "0.8125rem", marginTop: "0.125rem" }}>
              Group changes and settlement events
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--border)", cursor: "pointer", color: "var(--text-2)", fontSize: "1.25rem", lineHeight: 1, flexShrink: 0 }}>
            ×
          </button>
        </div>

        <div style={{ padding: "1rem 1.5rem 1.5rem", overflowY: "auto", flex: 1 }}>
          {loading ? (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {[1, 2, 3].map((item) => (
                <div key={item} className="card" style={{ padding: "1rem" }}>
                  <div style={{ height: 14, width: "55%", background: "var(--surface-2)", borderRadius: 6, marginBottom: "0.65rem" }} />
                  <div style={{ height: 12, width: "82%", background: "var(--surface-2)", borderRadius: 6 }} />
                </div>
              ))}
            </div>
          ) : activity.length === 0 ? (
            <div className="card" style={{ padding: "2.5rem 1.5rem", textAlign: "center" }}>
              <div style={{ width: 44, height: 44, margin: "0 auto 0.75rem", borderRadius: 10, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-2)", fontWeight: 800 }}>
                i
              </div>
              <p style={{ fontWeight: 700, marginBottom: "0.25rem" }}>No activity yet</p>
              <p style={{ color: "var(--text-2)", fontSize: "0.875rem" }}>
                Important group actions will appear here after they happen.
              </p>
            </div>
          ) : (
            Object.entries(grouped).map(([dateLabel, records]) => (
              <section key={dateLabel} style={{ marginBottom: "1.25rem" }}>
                <p style={{ color: "var(--text-3)", fontSize: "0.75rem", fontWeight: 800, margin: "0 0 0.6rem", textTransform: "uppercase" }}>
                  {dateLabel}
                </p>
                <div style={{ display: "grid", gap: "0.65rem" }}>
                  {records.map((record) => (
                    <div key={record.id} className="card" style={{ padding: "0.95rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                      <div
                        title={activityIconLabel(record.eventType)}
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 8,
                          background: activityIconBackground(record.eventType),
                          color: activityIconColor(record.eventType),
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.8rem",
                          fontWeight: 900,
                          flexShrink: 0,
                        }}
                      >
                        {activityIcon(record.eventType)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "flex-start", flexWrap: "wrap" }}>
                          <p style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--text)" }}>
                            {record.description}
                          </p>
                          <span className="badge" style={{ background: "var(--surface-2)", color: "var(--text-2)", flexShrink: 0 }}>
                            {activityShortType(record.eventType)}
                          </span>
                        </div>
                        <p style={{ color: "var(--text-2)", fontSize: "0.75rem", marginTop: "0.35rem" }}>
                          {record.actorName} · {formatDateTime(record.createdAt)}
                        </p>
                        {Object.keys(record.metadata).length > 0 && (
                          <p className="mono" style={{ color: "var(--text-3)", fontSize: "0.6875rem", marginTop: "0.35rem", overflowWrap: "anywhere" }}>
                            {formatActivityMetadata(record.metadata)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </aside>
    </>
  );
}

function BatchHistoryRenderer({ payments, group }: { payments: SettlementPayment[]; group: Group }) {
  const batches = useMemo(() => {
    const batchMap = new Map<string, SettlementPayment[]>();
    const singles: SettlementPayment[] = [];
    for (const p of payments) {
      if (p.batchId) {
        const arr = batchMap.get(p.batchId) ?? [];
        arr.push(p);
        batchMap.set(p.batchId, arr);
      } else {
        singles.push(p);
      }
    }
    return { batches: [...batchMap.entries()], singles };
  }, [payments]);

  return (
    <>
      {batches.batches.map(([batchId, batchPayments]) => {
        const totalAmount = batchPayments.reduce((sum, p) => sum + p.amount, 0);
        const sorted = [...batchPayments].sort((a, b) => getPaymentDate(b) - getPaymentDate(a));
        return (
          <div key={batchId} className="card" style={{ padding: "1.25rem 1.5rem" }}>
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                <p style={{ fontWeight: 700, fontSize: "0.9375rem" }}>Batch Settlement</p>
                <span className="badge" style={{ background: "var(--green-light)", color: "var(--green)" }}>
                  {batchPayments.length} payments
                </span>
              </div>
              <p style={{ color: "var(--text-2)", fontSize: "0.8125rem" }}>
                Total amount: <strong className="mono" style={{ color: "var(--text)" }}>{batchPayments[0]?.currency ?? group.currency} {totalAmount.toFixed(2)}</strong>
                {" · "}
                {formatDateTime(getPaymentDate(sorted[0]))}
              </p>
            </div>
            {sorted.map((payment) => (
              <div key={payment.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 0", borderTop: "1px solid var(--border)", gap: "0.75rem" }}>
                <div>
                  <p style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                    {payment.from} → {payment.to}
                  </p>
                  {payment.txHash && (
                    <a
                      className="mono"
                      href={`${ARC_TESTNET_EXPLORER_URL}/tx/${payment.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: "0.6875rem", color: "var(--blue)", textDecoration: "none" }}
                    >
                      {shortenHash(payment.txHash)}
                    </a>
                  )}
                </div>
                <div className="mono" style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--text)" }}>
                  {payment.currency} {payment.amount.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        );
      })}
      {batches.singles.map((payment) => (
        <div key={payment.id} className="card" style={{ padding: "1.25rem 1.5rem" }}>
          <div className="expense-row" style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                <p style={{ fontWeight: 700, fontSize: "0.9375rem" }}>
                  {payment.from} paid {payment.to}
                </p>
                <span className="badge" style={{ background: "var(--green-light)", color: "var(--green)" }}>
                  {payment.settlementStatus ?? payment.status}
                </span>
              </div>
              <p style={{ color: "var(--text-2)", fontSize: "0.8125rem", marginTop: "0.35rem" }}>
                Token used: <strong style={{ color: "var(--text)" }}>{payment.settlementTokenUsed ?? payment.currency}</strong>
                {" · "}
                Settled {formatDateTime(getPaymentDate(payment))}
              </p>
              <p className="mono" title={payment.txHash || undefined} style={{ color: "var(--text-3)", fontSize: "0.75rem", marginTop: "0.35rem", overflowWrap: "anywhere" }}>
                {payment.txHash || "Transaction hash not recorded"}
              </p>
            </div>
            <div className="expense-amount" style={{ textAlign: "right", flexShrink: 0 }}>
              <div className="mono" style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text)" }}>
                {payment.currency} {payment.amount.toFixed(2)}
              </div>
              <a
                className="btn-secondary"
                href={payment.txHash ? `${ARC_TESTNET_EXPLORER_URL}/tx/${payment.txHash}` : ARC_TESTNET_EXPLORER_URL}
                target="_blank"
                rel="noreferrer"
                style={{ marginTop: "0.75rem", padding: "0.45rem 0.7rem", fontSize: "0.75rem", textDecoration: "none" }}
              >
                View on Arcscan
              </a>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

function InviteSection({ group }: { group: Group }) {
  const [copied, setCopied] = useState(false);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const inviteUrl = `${baseUrl}/join/${group.inviteCode}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: `Join ${group.name} on StableSplit`, url: inviteUrl });
      } catch {
        // user cancelled
      }
    } else {
      await handleCopy();
    }
  };

  return (
    <div style={{ marginTop: "1.25rem", padding: "1rem 1.25rem", background: "var(--surface-2)", borderRadius: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <div>
          <p style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text)", marginBottom: "0.125rem" }}>
            🔗 Invite Members
          </p>
          <p className="mono" style={{ fontSize: "0.6875rem", color: "var(--text-3)", wordBreak: "break-all" }}>
            {inviteUrl}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
          <button
            type="button"
            onClick={handleCopy}
            className="btn-secondary"
            style={{ padding: "0.5rem 0.75rem", fontSize: "0.8125rem", whiteSpace: "nowrap" }}
          >
            {copied ? "✓ Copied!" : "Copy Invite Link"}
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="btn-secondary"
            style={{ padding: "0.5rem 0.75rem", fontSize: "0.8125rem", whiteSpace: "nowrap" }}
          >
            Share Invite Link
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p style={{ color: "var(--text-3)", fontSize: "0.75rem", fontWeight: 700, marginBottom: "0.2rem" }}>{label}</p>
      <p className={mono ? "mono" : undefined} style={{ color: "var(--text)", fontSize: "0.9rem", overflowWrap: "anywhere" }}>
        {value}
      </p>
    </div>
  );
}

function getPaymentDate(payment: SettlementPayment): number {
  return payment.settledAt ?? payment.updatedAt ?? payment.createdAt;
}

function formatDateTime(value: number): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function groupActivityByDate(activity: ActivityRecord[]): Record<string, ActivityRecord[]> {
  return activity.reduce<Record<string, ActivityRecord[]>>((groups, record) => {
    const label = new Date(record.createdAt).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    groups[label] = groups[label] ?? [];
    groups[label].push(record);
    return groups;
  }, {});
}

function activityIcon(eventType: ActivityRecord["eventType"]): string {
  if (eventType === "expense.created") return "+";
  if (eventType === "expense.deleted") return "-";
  if (eventType === "wallet.linked" || eventType === "wallet.updated") return "W";
  if (eventType === "settlement.completed") return "✓";
  if (eventType === "invite.generated" || eventType === "member.joined_via_invite") return "🔗";
  if (eventType.startsWith("batch.")) return "B";
  if (eventType.startsWith("group.")) return "G";
  if (eventType.startsWith("member.")) return "M";
  if (eventType.startsWith("settlement.")) return "$";
  return "i";
}

function activityIconLabel(eventType: ActivityRecord["eventType"]): string {
  return activityShortType(eventType);
}

function activityIconBackground(eventType: ActivityRecord["eventType"]): string {
  if (eventType === "expense.deleted" || eventType === "settlement.failed" || eventType === "group.deleted" || eventType === "batch.settlement_failed") return "var(--red-light)";
  if (eventType === "settlement.completed" || eventType === "wallet.linked" || eventType === "member.joined_via_invite" || eventType === "batch.settlement_completed") return "var(--green-light)";
  if (eventType === "expense.created" || eventType === "wallet.updated" || eventType === "invite.generated" || eventType === "batch.settlement_initiated") return "var(--blue-light)";
  return "var(--surface-2)";
}

function activityIconColor(eventType: ActivityRecord["eventType"]): string {
  if (eventType === "expense.deleted" || eventType === "settlement.failed" || eventType === "group.deleted" || eventType === "batch.settlement_failed") return "var(--red)";
  if (eventType === "settlement.completed" || eventType === "wallet.linked" || eventType === "member.joined_via_invite" || eventType === "batch.settlement_completed") return "var(--green)";
  if (eventType === "expense.created" || eventType === "wallet.updated" || eventType === "invite.generated" || eventType === "batch.settlement_initiated") return "var(--blue)";
  return "var(--text-2)";
}

function activityShortType(eventType: ActivityRecord["eventType"]): string {
  return eventType.split(".").map((part) => part.charAt(0).toUpperCase() + part.slice(1).replace("_", " ")).join(" ");
}

function formatActivityMetadata(metadata: Record<string, unknown>): string {
  const visibleEntries = Object.entries(metadata).filter(([, value]) => value !== "" && value !== undefined && value !== null);
  return visibleEntries
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`)
    .join(" · ");
}

function shortenHash(hash: string): string {
  if (hash.length <= 14) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function startOfWeek(ts: number): number {
  const d = new Date(ts);
  const day = d.getDay();
  return startOfDay(ts) - day * 86400000;
}

function startOfMonth(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

function startOfNextMonth(ts: number): number {
  const d = new Date(ts);
  const m = d.getMonth() + 1;
  return new Date(d.getFullYear(), m, 1).getTime();
}
