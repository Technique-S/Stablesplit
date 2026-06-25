import type { Expense, SettlementPayment, ActivityRecord, Group, Member, Balance, Settlement } from "./types";
import { shortenAddress } from "@/lib/members";

function escapeCSV(val: string | number | undefined | null): string {
  if (val == null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(values: (string | number | undefined | null)[]): string {
  return values.map(escapeCSV).join(",") + "\n";
}

export function expensesToCSV(expenses: Expense[], currency: string): string {
  let csv = csvRow(["Date", "Description", "Category", "Paid By", "Amount", "Status"]);
  for (const exp of expenses) {
    csv += csvRow([
      new Date(exp.date).toLocaleDateString("en-US"),
      exp.description,
      exp.category,
      exp.paidBy,
      `${currency} ${exp.amount.toFixed(2)}`,
      exp.lockedAt ? "Settled" : "Unsettled",
    ]);
  }
  return csv;
}

function memberDisplayName(from: string, members: Member[]): string {
  const m = members.find((mem) => mem.walletAddress?.toLowerCase() === from.toLowerCase() || mem.displayName === from);
  return m?.displayName ?? from;
}

export function settlementsToCSV(payments: SettlementPayment[], members: Member[]): string {
  let csv = csvRow(["Date", "Payer", "Recipient", "Amount", "Token", "Transaction Hash"]);
  for (const p of payments) {
    csv += csvRow([
      p.settledAt ? new Date(p.settledAt).toLocaleDateString("en-US") : new Date(p.createdAt).toLocaleDateString("en-US"),
      memberDisplayName(p.from, members),
      memberDisplayName(p.to, members),
      p.amount.toFixed(2),
      p.currency,
      p.txHash ?? "",
    ]);
  }
  return csv;
}

export function activityToCSV(records: ActivityRecord[]): string {
  let csv = csvRow(["Timestamp", "Action", "User"]);
  for (const r of records) {
    csv += csvRow([
      new Date(r.createdAt).toLocaleDateString("en-US") + " " + new Date(r.createdAt).toLocaleTimeString("en-US"),
      r.eventType,
      r.actorName,
    ]);
  }
  return csv;
}

export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadPDF(
  group: Group,
  expenses: Expense[],
  settlementPayments: SettlementPayment[],
  activityRecords: ActivityRecord[],
  balances: Balance[],
  settlements: Settlement[],
  members: Member[]
): Promise<void> {
  const { default: html2canvas } = await import("html2canvas");
  const { default: jsPDF } = await import("jspdf");

  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
  const totalSettled = settlementPayments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const totalPending = settlementPayments.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0);
  const paidCount = settlementPayments.filter((p) => p.status === "paid").length;
  const totalPayments = settlementPayments.length;
  const naiveCount = expenses.reduce((sum) => sum + 1, 0);
  const optimizedCount = settlements.length;
  const isDark = typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark";

  const fg = isDark ? "#e5e5e5" : "#1a1a1a";
  const bg = isDark ? "#1a1a1a" : "#ffffff";
  const muted = isDark ? "#888" : "#666";
  const border = isDark ? "#333" : "#e0e0e0";
  const accent = "#2563eb";

  const container = document.createElement("div");
  container.style.cssText = `position:fixed;left:-9999px;top:0;width:800px;background:${bg};color:${fg};font-family:'DM Sans',Arial,sans-serif;font-size:14px;line-height:1.5;padding:40px;`;

  function styleTable(): string {
    return `width:100%;border-collapse:collapse;margin-top:8px;font-size:12px;`;
  }
  function th(): string {
    return `padding:8px 10px;text-align:left;background:${isDark ? "#2a2a2a" : "#f5f5f5"};border-bottom:2px solid ${border};font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.03em;`;
  }
  function td(): string {
    return `padding:8px 10px;border-bottom:1px solid ${border};`;
  }

  let html = `<div style="max-width:720px;margin:0 auto;">`;

  html += `<div style="text-align:center;padding-bottom:24px;border-bottom:2px solid ${accent};margin-bottom:24px;">
    <h1 style="font-size:22px;font-weight:700;margin:0;color:${accent};">StableSplit Report</h1>
    <p style="font-size:16px;font-weight:600;margin:6px 0 2px;">${escapeCSV(group.name)}</p>
    <p style="font-size:12px;color:${muted};margin:0;">Generated ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
  </div>`;

  html += `<h2 style="font-size:16px;font-weight:700;margin:0 0 8px;color:${accent};">Group Information</h2>
  <table style="${styleTable()}">
    <tr><td style="${td()}font-weight:600;width:140px;">Name</td><td style="${td()}">${escapeCSV(group.name)}</td></tr>
    <tr><td style="${td()}font-weight:600;">Description</td><td style="${td()}">${escapeCSV(group.description ?? "—")}</td></tr>
    <tr><td style="${td()}font-weight:600;">Members</td><td style="${td()}">${members.length}</td></tr>
    <tr><td style="${td()}font-weight:600;">Currency</td><td style="${td()}">${escapeCSV(group.currency)}</td></tr>
    <tr><td style="${td()}font-weight:600;">Created</td><td style="${td()}">${new Date(group.createdAt).toLocaleDateString("en-US")}</td></tr>
    <tr><td style="${td()}font-weight:600;">Invite Code</td><td style="${td()}">${escapeCSV(group.inviteCode ?? "—")}</td></tr>
  </table>
  <div style="height:20px;"></div>`;

  html += `<h2 style="font-size:16px;font-weight:700;margin:0 0 8px;color:${accent};">Member Summary</h2>
  <table style="${styleTable()}">
    <thead><tr><th style="${th()}">Name</th><th style="${th()}">Wallet</th><th style="${th()}">Balance</th></tr></thead>
    <tbody>`;
  for (const b of balances) {
    const m = members.find((mem) => mem.displayName === b.member);
    const wallet = m?.walletAddress ? shortenAddress(m.walletAddress) : "—";
    const sign = b.net >= 0 ? "+" : "";
    html += `<tr><td style="${td()}">${escapeCSV(b.member)}</td><td style="${td()};color:${muted}">${wallet}</td><td style="${td()};font-weight:600;color:${b.net >= 0 ? "#16a34a" : "#dc2626"}">${sign}${escapeCSV(group.currency)} ${b.net.toFixed(2)}</td></tr>`;
  }
  html += `</tbody></table>
  <div style="height:20px;"></div>`;

  html += `<h2 style="font-size:16px;font-weight:700;margin:0 0 8px;color:${accent};">Expense Summary</h2>
  <table style="${styleTable()}">
    <tr><td style="${td()}font-weight:600;width:200px;">Total Expenses</td><td style="${td()}">${expenses.length}</td></tr>
    <tr><td style="${td()}font-weight:600;">Total Spent</td><td style="${td()}">${escapeCSV(group.currency)} ${totalSpent.toFixed(2)}</td></tr>
    <tr><td style="${td()}font-weight:600;">Average per Expense</td><td style="${td()}">${escapeCSV(group.currency)} ${expenses.length > 0 ? (totalSpent / expenses.length).toFixed(2) : "0.00"}</td></tr>
  </table>
  <div style="height:20px;"></div>`;

  html += `<h2 style="font-size:16px;font-weight:700;margin:0 0 8px;color:${accent};">Settlement Summary</h2>
  <table style="${styleTable()}">
    <thead><tr><th style="${th()}">From</th><th style="${th()}">To</th><th style="${th()}">Amount</th></tr></thead>
    <tbody>`;
  for (const s of settlements) {
    html += `<tr><td style="${td()}">${escapeCSV(s.from)}</td><td style="${td()}">${escapeCSV(s.to)}</td><td style="${td()}">${escapeCSV(group.currency)} ${s.amount.toFixed(2)}</td></tr>`;
  }
  if (settlements.length === 0) {
    html += `<tr><td style="${td()};text-align:center;color:${muted};" colspan="3">No outstanding settlements</td></tr>`;
  }
  html += `</tbody></table>
  <div style="height:20px;"></div>`;

  html += `<h2 style="font-size:16px;font-weight:700;margin:0 0 8px;color:${accent};">ARC Metrics</h2>
  <table style="${styleTable()}">
    <tr><td style="${td()}font-weight:600;width:200px;">Total Settled</td><td style="${td()}">${escapeCSV(group.currency)} ${totalSettled.toFixed(2)}</td></tr>
    <tr><td style="${td()}font-weight:600;">Pending</td><td style="${td()}">${escapeCSV(group.currency)} ${totalPending.toFixed(2)}</td></tr>
    <tr><td style="${td()}font-weight:600;">Payments Completed</td><td style="${td()}">${paidCount} / ${totalPayments}</td></tr>
    <tr><td style="${td()}font-weight:600;">Completion Rate</td><td style="${td()}">${totalPayments > 0 ? Math.round((paidCount / totalPayments) * 100) : 0}%</td></tr>
    <tr><td style="${td()}font-weight:600;">Optimization</td><td style="${td()}">Naive: ${naiveCount} → Optimized: ${optimizedCount}</td></tr>
  </table>
  <div style="height:20px;"></div>`;

  html += `<h2 style="font-size:16px;font-weight:700;margin:0 0 8px;color:${accent};">Payment History</h2>
  <table style="${styleTable()}">
    <thead><tr><th style="${th()}">Date</th><th style="${th()}">Payer</th><th style="${th()}">Recipient</th><th style="${th()}">Amount</th><th style="${th()}">Token</th><th style="${th()}">Tx Hash</th><th style="${th()}">Status</th></tr></thead>
    <tbody>`;
  const sortedPayments = [...settlementPayments].sort((a, b) => (b.settledAt ?? b.createdAt) - (a.settledAt ?? a.createdAt));
  for (const p of sortedPayments) {
    const date = p.settledAt ? new Date(p.settledAt).toLocaleDateString("en-US") : new Date(p.createdAt).toLocaleDateString("en-US");
    html += `<tr>
      <td style="${td()}">${date}</td>
      <td style="${td()}">${escapeCSV(memberDisplayName(p.from, members))}</td>
      <td style="${td()}">${escapeCSV(memberDisplayName(p.to, members))}</td>
      <td style="${td()}">${escapeCSV(group.currency)} ${p.amount.toFixed(2)}</td>
      <td style="${td()}">${escapeCSV(p.currency)}</td>
      <td style="${td()};color:${muted};font-family:monospace;font-size:11px;">${p.txHash ? p.txHash.slice(0, 10) + "..." : "—"}</td>
      <td style="${td()}">${escapeCSV(p.status)}</td>
    </tr>`;
  }
  if (sortedPayments.length === 0) {
    html += `<tr><td style="${td()};text-align:center;color:${muted};" colspan="7">No payment history</td></tr>`;
  }
  html += `</tbody></table>
  <div style="height:20px;"></div>`;

  html += `<h2 style="font-size:16px;font-weight:700;margin:0 0 8px;color:${accent};">Activity Timeline</h2>
  <table style="${styleTable()}">
    <thead><tr><th style="${th()}">Timestamp</th><th style="${th()}">Action</th><th style="${th()}">User</th></tr></thead>
    <tbody>`;
  const sortedActivity = [...activityRecords].sort((a, b) => b.createdAt - a.createdAt);
  for (const r of sortedActivity.slice(0, 50)) {
    html += `<tr>
      <td style="${td()}">${new Date(r.createdAt).toLocaleDateString("en-US")} ${new Date(r.createdAt).toLocaleTimeString("en-US")}</td>
      <td style="${td()}">${escapeCSV(r.eventType)}</td>
      <td style="${td()}">${escapeCSV(r.actorName)}</td>
    </tr>`;
  }
  if (sortedActivity.length === 0) {
    html += `<tr><td style="${td()};text-align:center;color:${muted};" colspan="3">No activity recorded</td></tr>`;
  }
  html += `</tbody></table>`;

  html += `<div style="margin-top:32px;padding-top:16px;border-top:1px solid ${border};text-align:center;font-size:11px;color:${muted};">Generated by StableSplit</div>`;
  html += `</div>`;

  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: bg,
      logging: false,
      width: 800,
      windowWidth: 800,
    });

    const imgData = canvas.toDataURL("image/png");
    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const pdf = new jsPDF("p", "mm", "a4");
    let heightLeft = imgHeight;
    let position = 0;
    const pageHeight = 297;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`${group.name.replace(/[^a-zA-Z0-9]/g, "_")}_Report.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
