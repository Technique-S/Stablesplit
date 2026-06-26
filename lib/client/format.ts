const ONE_MINUTE_MS = 60000;
const ONE_HOUR_MS = 3600000;
const ONE_DAY_MS = 86400000;
const ONE_WEEK_MS = 604800000;

export function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < ONE_MINUTE_MS) return "Just now";
  if (diff < ONE_HOUR_MS) return `${Math.floor(diff / ONE_MINUTE_MS)}m ago`;
  if (diff < ONE_DAY_MS) return `${Math.floor(diff / ONE_HOUR_MS)}h ago`;
  if (diff < ONE_WEEK_MS) return `${Math.floor(diff / ONE_DAY_MS)}d ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
