import { Skeleton } from "@/components/ui/skeleton";

export default function PlantsLoading() {
  return (
    <div>
      <div className="px-[22px] md:px-8 pt-6 pb-5" style={{ borderBottom: "1px solid #E4E4DC" }}>
        <Skeleton className="h-3 w-24 mb-2 rounded" />
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="px-[22px] md:px-8 pt-4 pb-8">
        <Skeleton className="h-10 w-full rounded-lg mb-4" />
        <div className="flex gap-2 flex-wrap mb-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="rounded-xl overflow-hidden border border-[#E4E4DC]">
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
    </div>
  );
}
