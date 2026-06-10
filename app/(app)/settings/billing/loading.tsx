import { Skeleton } from "@/components/ui/skeleton";

export default function BillingLoading() {
  return (
    <div>
      <div className="px-[22px] md:px-8 pt-6 pb-5" style={{ borderBottom: "1px solid #E4E4DC" }}>
        <Skeleton className="h-3 w-20 mb-2 rounded" />
        <Skeleton className="h-8 w-44" />
      </div>
      <div className="px-[22px] md:px-8 py-5">
        {/* Plan cards */}
        <div className="grid gap-4 sm:grid-cols-2 mb-8">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="rounded-xl border border-[#E4E4DC] p-5 space-y-4">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-8 w-28" />
              <div className="space-y-2">
                {[...Array(5)].map((_, j) => (
                  <Skeleton key={j} className="h-3 w-full" />
                ))}
              </div>
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
