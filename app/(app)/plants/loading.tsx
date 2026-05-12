import { Skeleton } from "@/components/ui/skeleton";

export default function PlantsLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6 space-y-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      {/* Search input */}
      <Skeleton className="h-10 w-full rounded-lg mb-4" />
      {/* Category pills */}
      <div className="flex gap-2 flex-wrap mb-6">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      {/* Plant grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="rounded-xl overflow-hidden border border-[#E8E2D9]">
            <Skeleton className="aspect-[4/3] w-full" />
            <div className="p-3 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <div className="flex gap-1 pt-1">
                <Skeleton className="h-5 w-10 rounded-md" />
                <Skeleton className="h-5 w-16 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
