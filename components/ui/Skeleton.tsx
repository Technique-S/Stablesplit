"use client";

export function Skeleton({ width, height, borderRadius = 6 }: { width?: string; height?: number; borderRadius?: number }) {
  return (
    <div
      className="skeleton"
      style={{
        width: width ?? "100%",
        height: height ?? 16,
        borderRadius,
      }}
    />
  );
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card" style={{ padding: "1.5rem" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} width={`${40 + Math.random() * 40}%`} />
        ))}
      </div>
    </div>
  );
}

export function ActivitySkeleton() {
  return (
    <div className="card" style={{ padding: "1.5rem" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <div className="skeleton" style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: 14, width: "60%", marginBottom: "0.25rem" }} />
              <div className="skeleton" style={{ height: 12, width: "30%" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
