"use client";

import { useState } from "react";
import { Group, Expense, SettlementPayment, ActivityRecord, Member, Balance, Settlement } from "@/lib/types";
import { expensesToCSV, settlementsToCSV, activityToCSV, downloadCSV, downloadPDF } from "@/lib/export";

interface Props {
  group: Group;
  expenses: Expense[];
  settlementPayments: SettlementPayment[];
  activityRecords: ActivityRecord[];
  members: Member[];
  balances: Balance[];
  settlements: Settlement[];
  onClose: () => void;
}

type ExportTarget = "expenses" | "settlements" | "activity" | "pdf" | null;

interface ExportCard {
  id: ExportTarget;
  icon: string;
  title: string;
  desc: string;
}

const CARDS: ExportCard[] = [
  { id: "expenses", icon: "csv", title: "Expenses CSV", desc: "Date, description, category, payer, amount, and status for every expense." },
  { id: "settlements", icon: "csv", title: "Settlements CSV", desc: "Date, payer, recipient, amount, token, and transaction hash for each settlement." },
  { id: "activity", icon: "csv", title: "Activity CSV", desc: "Timestamp, action type, and actor name for the full activity log." },
  { id: "pdf", icon: "pdf", title: "Full Group PDF", desc: "Professional report with group info, balances, expenses, settlements, ARC metrics, and activity." },
];

export default function ExportModal({ group, expenses, settlementPayments, activityRecords, members, balances, settlements, onClose }: Props) {
  const [exporting, setExporting] = useState<ExportTarget>(null);
  const [error, setError] = useState("");

  const handleExport = async (target: ExportTarget) => {
    if (!target) return;
    setExporting(target);
    setError("");

    try {
      if (target === "expenses") {
        const csv = expensesToCSV(expenses, group.currency);
        downloadCSV(csv, `${group.name}_Expenses.csv`);
      } else if (target === "settlements") {
        const csv = settlementsToCSV(settlementPayments, members);
        downloadCSV(csv, `${group.name}_Settlements.csv`);
      } else if (target === "activity") {
        const csv = activityToCSV(activityRecords);
        downloadCSV(csv, `${group.name}_Activity.csv`);
      } else if (target === "pdf") {
        await downloadPDF(group, expenses, settlementPayments, activityRecords, balances, settlements, members);
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <>
      <div onClick={onClose} className="animate-backdrop" style={{ position: "fixed", inset: 0, background: "var(--overlay)", backdropFilter: "blur(4px)", zIndex: 100 }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 101, display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(0.75rem, 3vw, 2rem)", pointerEvents: "none" }}>
        <div className="animate-scale-in" style={{ width: "min(480px, 100%)", background: "var(--surface)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)", overflow: "hidden", pointerEvents: "auto" }}>
          <div style={{ padding: "1.5rem 1.75rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start" }}>
              <div>
                <h2 style={{ fontWeight: 700, fontSize: "1.125rem", letterSpacing: "-0.02em" }}>Export Data</h2>
                <p style={{ color: "var(--text-2)", fontSize: "0.8125rem", marginTop: "0.125rem" }}>
                  Choose what to export from <strong>{group.name}</strong>
                </p>
              </div>
              {!exporting && (
                <button type="button" onClick={onClose} aria-label="Close" style={{ width: 32, height: 32, borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-2)", flexShrink: 0, transition: "all 0.15s ease" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-3)"; e.currentTarget.style.color = "var(--text)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface-2)"; e.currentTarget.style.color = "var(--text-2)"; }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              )}
            </div>
          </div>

          <div style={{ padding: "1.25rem 1.75rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {error && (
              <div style={{ padding: "0.75rem 1rem", background: "var(--red-light)", border: "1px solid var(--error-border)", borderRadius: 8, fontSize: "0.8125rem", color: "var(--red)", fontWeight: 600 }}>
                {error}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.625rem" }}>
              {CARDS.map((card) => {
                const isExporting = exporting === card.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => { if (!exporting) handleExport(card.id); }}
                    disabled={!!exporting}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center", gap: "0.375rem",
                      padding: "1.25rem 0.75rem", borderRadius: 10,
                      background: exporting ? "var(--surface-2)" : "var(--surface-2)",
                      border: exporting ? "1px solid var(--surface-2)" : "1px solid var(--border)",
                      cursor: exporting ? "default" : "pointer",
                      transition: "all 0.15s",
                      opacity: exporting && !isExporting ? 0.5 : 1,
                      textAlign: "center",
                    }}
                    onMouseEnter={(e) => { if (!exporting) { e.currentTarget.style.borderColor = "var(--blue)"; e.currentTarget.style.background = "var(--blue-light)"; } }}
                    onMouseLeave={(e) => { if (!exporting) { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--surface-2)"; } }}
                  >
                    <span style={{ fontSize: "1.5rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {isExporting ? (
                        <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                      ) : card.icon === "csv" ? (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="4" y="2" width="16" height="20" rx="3" stroke="var(--text-2)" strokeWidth="1.5"/><path d="M8 10H16M8 14H14M8 18H12" stroke="var(--text-2)" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      ) : (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="4" y="2" width="16" height="20" rx="3" stroke="var(--text-2)" strokeWidth="1.5"/><circle cx="16" cy="16" r="4" stroke="var(--text-2)" strokeWidth="1.5"/><path d="M16 14V18M14 16H18" stroke="var(--text-2)" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      )}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text)" }}>{card.title}</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-2)", lineHeight: 1.4 }}>{card.desc}</span>
                  </button>
                );
              })}
            </div>

            {exporting && (
              <p style={{ fontSize: "0.8125rem", color: "var(--text-2)", textAlign: "center", margin: 0 }}>
                {exporting === "pdf" ? "Generating report..." : "Preparing download..."}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
