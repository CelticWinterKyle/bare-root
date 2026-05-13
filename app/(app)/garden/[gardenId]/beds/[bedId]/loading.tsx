import { Skeleton } from "@/components/ui/skeleton";

export default function BedLoading() {
  return (
    <div className="w-full flex flex-col">
      <div className="px-[22px] md:px-8 pt-5 pb-4" style={{ borderBottom: "1px solid #E4E4DC" }}>
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="h-[22px] w-[22px] rounded-md shrink-0" />
          <Skeleton className="h-3 w-20 rounded" />
        </div>
        <Skeleton className="h-8 w-40 mb-1" />
        <Skeleton className="h-3 w-56 rounded" />
      </div>
      <div className="px-[22px] md:px-8 py-4">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-9 w-20 rounded-lg" />
          <Skeleton className="h-9 w-20 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg ml-auto" />
        </div>
        <Skeleton className="w-full rounded-2xl" style={{ height: 300 }} />
        <div className="flex gap-3 mt-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-4 w-16 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
