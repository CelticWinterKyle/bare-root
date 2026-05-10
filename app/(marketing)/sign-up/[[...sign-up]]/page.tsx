import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2]">
      <SignUp />
    </div>
  );
}
