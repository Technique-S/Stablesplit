"use client";

import { FormEvent, useState } from "react";
import { useAccount } from "wagmi";
import { createExpense } from "@/lib/client/db";
import { ExpenseCategory, RecurrenceFrequency, SupportedCurrency } from "@/lib/types";
import { FREQUENCY_LABELS, getNextRecurrenceDate } from "@/lib/domain/recurrence";
import { CATEGORY_ICONS } from "@/lib/calculations";
import { getRates, convert } from "@/lib/domain/rates";

const SUPPORTED_CURRENCIES: { code: SupportedCurrency; label: string }[] = [
  { code: "USD", label: "USD" },
  { code: "EUR", label: "EUR" },
  { code: "GBP", label: "GBP" },
  { code: "NGN", label: "NGN" },
  { code: "JPY", label: "JPY" },
  { code: "CAD", label: "CAD" },
  { code: "AUD", label: "AUD" },
  { code: "INR", label: "INR" },
];

interface Props {
  groupId: string;
  members: string[];
  currency: string;
  onClose: () => void;
  onAdded: () => void;
}

const CATEGORIES: ExpenseCategory[] = [
  "food", "transport", "accommodation", "entertainment", "utilities", "other",
];

function toDateInput(value: number): string {
  return new Date(value).toISOString().slice(0, 10);
}

export default function AddExpenseModal({ groupId, members, currency, onClose, onAdded }: Props) {
  const { address } = useAccount();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState(members[0] ?? "");
  const [splitAmong, setSplitAmong] = useState<string[]>(members);
  const [category, setCategory] = useState<ExpenseCategory>("other");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(toDateInput(Date.now()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurFrequency, setRecurFrequency] = useState<RecurrenceFrequency>("monthly");
  const [expenseCurrency, setExpenseCurrency] = useState<SupportedCurrency>(currency as SupportedCurrency);

  const toggleSplit = (m: string) => {
    if (splitAmong.includes(m)) {
      if (splitAmong.length === 1) return;
      setSplitAmong(splitAmong.filter((member) => member !== m));
    } else {
      setSplitAmong([...splitAmong, m]);
    }
  };

  const handleSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!description.trim()) { setError("Description is required."); return; }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { setError("Enter a valid amount."); return; }
    if (!paidBy) { setError("Choose who paid."); return; }
    if (!date) { setError("Choose a date."); return; }
    if (splitAmong.length === 0) { setError("Select at least one member to split with."); return; }

    setLoading(true);
    setError("");
    try {
      const expenseDate = new Date(`${date}T12:00:00`).getTime();

      let originalCurrency: string | undefined;
      let baseUsdAmount: number | undefined;
      let baseEurAmount: number | undefined;
      let fxRate: number | undefined;

      if (expenseCurrency !== "USD") {
        const rates = await getRates();
        baseUsdAmount = Math.round(convert(amt, expenseCurrency, "USD", rates) * 100) / 100;
        baseEurAmount = Math.round(convert(amt, expenseCurrency, "EUR", rates) * 100) / 100;
        fxRate = Math.round((1 / rates[expenseCurrency]) * 1000000) / 1000000;
        originalCurrency = expenseCurrency;
      }

      const payload = {
        description: description.trim(),
        amount: Math.round(amt * 100) / 100,
        paidBy,
        splitAmong,
        category,
        notes: notes.trim(),
        date: expenseDate,
        ...(isRecurring ? {
          recurrence: {
            frequency: recurFrequency,
            nextDate: getNextRecurrenceDate(recurFrequency, expenseDate),
            isPaused: false,
          },
        } : {}),
        ...(originalCurrency ? { originalCurrency, baseUsdAmount, baseEurAmount, fxRate } : {}),
      };

      await createExpense(groupId, payload, address);
      onAdded();
    } catch (e) {
      setError("Failed to add expense.");
      setLoading(false);
    }
  };

  const perPerson = amount && splitAmong.length > 0
    ? (parseFloat(amount) / splitAmong.length).toFixed(2)
    : null;

  return (
    <>
      <div
        className="animate-backdrop"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--overlay)",
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
          className="animate-modal-in"
          style={{
            display: "flex",
            flexDirection: "column",
            width: "min(540px, 100%)",
            maxHeight: "min(760px, calc(100dvh - 1.5rem))",
            background: "var(--surface)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-lg)",
            overflow: "hidden",
            pointerEvents: "auto",
          }}
        >
          <div
            style={{
              padding: "1.5rem 1.75rem 1.25rem",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "1rem",
              flexShrink: 0,
            }}
          >
            <div>
              <h2 style={{ fontWeight: 700, fontSize: "1.125rem", letterSpacing: "-0.02em" }}>
                Add Expense
              </h2>
              <p style={{ color: "var(--text-2)", fontSize: "0.8125rem", marginTop: "0.125rem" }}>
                Split a new cost with the group
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="modal-close-btn"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: "1.5rem 1.75rem", overflowY: "auto", flex: 1, minHeight: 0 }}>
            {/* Type selector */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                Type
              </label>
              <div style={{ display: "flex", gap: "0.5rem", background: "var(--surface-2)", padding: "0.25rem", borderRadius: 10, border: "1px solid var(--border)" }}>
                {["one-time", "recurring"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setIsRecurring(t === "recurring")}
                    style={{
                      flex: 1,
                      padding: "0.5rem 0.75rem",
                      borderRadius: 7,
                      border: "none",
                      background: (t === "recurring") === isRecurring ? "var(--surface)" : "transparent",
                      color: (t === "recurring") === isRecurring ? "var(--text)" : "var(--text-2)",
                      fontWeight: (t === "recurring") === isRecurring ? 600 : 400,
                      fontSize: "0.8125rem",
                      cursor: "pointer",
                      transition: "all 0.15s",
                      boxShadow: (t === "recurring") === isRecurring ? "var(--shadow-sm)" : "none",
                      fontFamily: "DM Sans, sans-serif",
                      textTransform: "capitalize",
                    }}
                  >
                    {t === "one-time" ? "One-time" : "Recurring"}
                  </button>
                ))}
              </div>
            </div>

            {/* Frequency picker */}
            {isRecurring && (
              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Frequency
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {(["weekly", "monthly", "quarterly", "yearly"] as RecurrenceFrequency[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setRecurFrequency(f)}
                      style={{
                        padding: "0.375rem 0.875rem",
                        borderRadius: 6,
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        border: `1.5px solid ${recurFrequency === f ? "var(--blue)" : "var(--border)"}`,
                        background: recurFrequency === f ? "var(--blue-light)" : "transparent",
                        color: recurFrequency === f ? "var(--blue)" : "var(--text-2)",
                        cursor: "pointer",
                        transition: "all 0.15s",
                        fontFamily: "DM Sans, sans-serif",
                      }}
                    >
                      {FREQUENCY_LABELS[f]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Category */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                Category
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {CATEGORIES.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setCategory(c)}
                    style={{
                      padding: "0.375rem 0.75rem",
                      borderRadius: 8,
                      fontSize: "0.8125rem",
                      fontWeight: 500,
                      border: `1.5px solid ${category === c ? "var(--blue)" : "var(--border)"}`,
                      background: category === c ? "var(--blue-light)" : "transparent",
                      color: category === c ? "var(--blue)" : "var(--text-2)",
                      cursor: "pointer",
                      transition: "all 0.15s",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.375rem",
                      fontFamily: "DM Sans, sans-serif",
                    }}
                  >
                    <span>{CATEGORY_ICONS[c]}</span>
                    <span style={{ textTransform: "capitalize" }}>{c}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label htmlFor="expense-title" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                Title *
              </label>
              <input
                id="expense-title"
                className="input-field"
                placeholder="e.g. Dinner at Nobu"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Date */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label htmlFor="expense-date" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                Date
              </label>
              <input
                id="expense-date"
                className="input-field"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {/* Amount */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label htmlFor="expense-amount" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                Amount *
              </label>
              <div style={{ position: "relative" }}>
                <span
                  style={{
                    position: "absolute", left: "0.875rem", top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: "0.875rem", color: "var(--text-2)", fontWeight: 600,
                  }}
                >
                  {expenseCurrency}
                </span>
                <input
                  id="expense-amount"
                  className="input-field mono"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={{ paddingLeft: "3.5rem" }}
                />
              </div>
              {perPerson && (
                <p style={{ fontSize: "0.75rem", color: "var(--blue)", marginTop: "0.375rem", fontWeight: 500 }}>
                  {expenseCurrency} {perPerson} per person ({splitAmong.length} people)
                </p>
              )}
            </div>

            {/* Currency */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label htmlFor="expense-currency" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                Currency
              </label>
              <select
                id="expense-currency"
                className="input-field"
                value={expenseCurrency}
                onChange={(e) => setExpenseCurrency(e.target.value as SupportedCurrency)}
                style={{ fontFamily: "DM Sans, sans-serif" }}
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Paid by */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label htmlFor="expense-paidby" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                Paid by
              </label>
              <select
                id="expense-paidby"
                className="input-field"
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
                style={{ fontFamily: "DM Sans, sans-serif" }}
              >
                {members.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Split among */}
            <div style={{ marginBottom: "0.5rem" }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                Split among
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {members.map((m) => {
                  const selected = splitAmong.includes(m);
                  return (
                    <button
                      type="button"
                      key={m}
                      onClick={() => toggleSplit(m)}
                      style={{
                        padding: "0.375rem 0.875rem",
                        borderRadius: 8,
                        fontSize: "0.8125rem",
                        fontWeight: 500,
                        border: `1.5px solid ${selected ? "var(--blue)" : "var(--border)"}`,
                        background: selected ? "var(--blue-light)" : "transparent",
                        color: selected ? "var(--blue)" : "var(--text-2)",
                        cursor: "pointer",
                        transition: "all 0.15s",
                        fontFamily: "DM Sans, sans-serif",
                      }}
                    >
                      {selected ? "✓ " : ""}{m}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginTop: "1.25rem", marginBottom: "0.5rem" }}>
              <label htmlFor="expense-notes" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                Notes
              </label>
              <textarea
                id="expense-notes"
                className="input-field"
                rows={3}
                placeholder="Optional details"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ resize: "vertical" }}
              />
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
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "1.25rem 1.75rem",
              borderTop: "1px solid var(--border)",
              display: "flex",
              gap: "0.75rem",
              justifyContent: "flex-end",
              flexWrap: "wrap",
              flexShrink: 0,
              background: "var(--surface)",
            }}
          >
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Adding..." : "Add Expense"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
