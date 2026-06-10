import { Skeleton } from "@/components/ui/skeleton";

export default function RemindersLoading() {
  return (
    <div className="container-narrow">
      <div className="px-[22px] md:px-8 pt-6 pb-5" style={{ borderBottom: "1px solid #E4E4DC" }}>
        <Skeleton className="h-3 w-24 mb-2 rounded" />
        <Skeleton className="h-8 w-44" />
      </div>
      <div className="px-[22px] md:px-8 py-5">
        {[...Array(2)].map((_, g) => (
          <div key={g} className="mb-8">
            {/* Day-group label */}
            <Skeleton className="h-3 w-20 mb-3 rounded" />
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-[#E4E4DC] overflow-hidden">
                  <Skeleton className="w-1 self-stretch rounded-none shrink-0" />
                  <Skeleton className="h-8 w-8 rounded-lg shrink-0 my-3.5" />
                  <div className="flex-1 space-y-2 py-3.5 pr-3.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
