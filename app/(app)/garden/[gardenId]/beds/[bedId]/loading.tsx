import { Skeleton } from "@/components/ui/skeleton";

export default function BedLoading() {
  return (
    <div className="w-full px-8 py-8 flex flex-col justify-center" style={{ minHeight: "calc(100dvh - 120px)" }}>
      {/* Header */}
      <div className="max-w-3xl mx-auto mb-6 w-full space-y-2">
        <Skeleton className="h-6 w-72" />
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
      {/* Toolbar */}
      <div className="max-w-3xl mx-auto mb-6 w-full flex items-center gap-2">
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg ml-auto" />
      </div>
      {/* Bed grid */}
      <Skeleton className="w-full rounded-2xl mx-auto" style={{ height: 260 }} />
      {/* Legend */}
      <div className="flex justify-center gap-3 mt-6">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-4 w-16 rounded" />
        ))}
      </div>
    </div>
  );
}
