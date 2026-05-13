import { Skeleton } from "@/components/ui/skeleton";

export default function GardenLoading() {
  return (
    <div>
      <div className="px-[22px] md:px-8 pt-6 pb-5" style={{ borderBottom: "1px solid #E4E4DC" }}>
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-9 w-48" />
            <div className="flex gap-2 mt-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        </div>
      </div>
      <div className="px-[22px] md:px-8 py-5">
        <Skeleton className="h-16 w-full rounded-xl mb-5" />
        <Skeleton className="w-full rounded-2xl" style={{ height: 340 }} />
      </div>
    </div>
  );
}
