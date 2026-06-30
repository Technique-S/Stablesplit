import { CardSkeleton, ActivitySkeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "1.5rem" }}>
      <CardSkeleton rows={2} />
      <ActivitySkeleton />
    </div>
  );
}
