import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div>
      <div className="px-[22px] md:px-8 pt-6 pb-5" style={{ borderBottom: "1px solid #E4E4DC" }}>
        <Skeleton className="h-3 w-24 mb-2 rounded" />
        <Skeleton className="h-9 w-48" />
      </div>
      <div className="px-[22px] md:px-8 py-5 space-y-3">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-2xl overflow-hidden border border-[#E4E4DC]">
            <Skeleton className="h-24 w-full" />
            <div className="px-5 py-4 bg-white flex items-center justify-between">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-4 w-4 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
