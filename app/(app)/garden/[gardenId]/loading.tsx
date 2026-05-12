import { Skeleton } from "@/components/ui/skeleton";

export default function GardenLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 pt-8 pb-5">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>
      {/* Weather strip */}
      <Skeleton className="h-16 w-full rounded-xl mb-5" />
      {/* Canvas */}
      <div className="px-4">
        <Skeleton className="w-full rounded-2xl" style={{ height: 340 }} />
      </div>
    </div>
  );
}
