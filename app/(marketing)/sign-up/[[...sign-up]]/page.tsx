import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAF7F2] px-4 py-12">
      <SignUp />
      <p className="mt-6 max-w-sm text-center text-xs text-[#6B6B5A]">
        By signing up you agree to our{" "}
        <Link href="/terms" className="underline hover:text-[#111109]">Terms of Service</Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline hover:text-[#111109]">Privacy Policy</Link>.
      </p>
    </div>
  );
}
