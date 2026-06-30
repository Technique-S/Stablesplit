import { CardSkeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "1.5rem" }}>
      <div className="skeleton" style={{ width: 200, height: 28, marginBottom: 12, borderRadius: 6 }} />
      <div
        className="skeleton"
        style={{ width: 160, height: 20, marginBottom: 24, borderRadius: 6 }}
      />
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: 24 }}>
        <div className="skeleton" style={{ width: 80, height: 32, borderRadius: 8 }} />
        <div className="skeleton" style={{ width: 80, height: 32, borderRadius: 8 }} />
        <div className="skeleton" style={{ width: 80, height: 32, borderRadius: 8 }} />
      </div>
      <CardSkeleton rows={2} />
      <CardSkeleton rows={3} />
      <CardSkeleton rows={2} />
    </div>
  );
}
