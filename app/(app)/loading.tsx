import { Loader2 } from "lucide-react";

export default function AppLoading() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-6 h-6 text-[#6B8F47] animate-spin" />
    </div>
  );
}
