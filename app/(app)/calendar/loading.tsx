import { Skeleton } from "@/components/ui/skeleton";

export default function CalendarLoading() {
  return (
    <div>
      <div className="px-[22px] md:px-8 pt-6 pb-5" style={{ borderBottom: "1px solid #E4E4DC" }}>
        <Skeleton className="h-3 w-20 mb-2 rounded" />
        <Skeleton className="h-9 w-48" />
      </div>
      <div className="px-[22px] md:px-8 py-5">
        <Skeleton className="h-28 w-full rounded-2xl mb-4" />
        {[...Array(2)].map((_, g) => (
          <div key={g} className="mb-8">
            <Skeleton className="h-5 w-28 mb-4 rounded" />
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-[#E4E4DC]">
                  <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2 pt-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
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
