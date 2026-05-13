import { Skeleton } from "@/components/ui/skeleton";

export default function PlantDetailLoading() {
  return (
    <div>
      <div className="px-[22px] md:px-8 pt-5 pb-4" style={{ borderBottom: "1px solid #E4E4DC" }}>
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <Skeleton className="h-[22px] w-[22px] rounded-md shrink-0" />
          <Skeleton className="h-3 w-24 rounded" />
        </div>
      </div>
      <div className="px-[22px] md:px-8 py-5">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl border border-[#E4E4DC] overflow-hidden mb-4">
            <Skeleton className="w-full" style={{ aspectRatio: "16/7" }} />
            <div className="p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="space-y-2">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-3 w-36 rounded" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full shrink-0" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="h-3 w-3/4 rounded" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-36 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
