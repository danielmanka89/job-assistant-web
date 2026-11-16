import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetFlow } from "./reset-flow";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      subtitle="Two quick checks keep your account safe: a code by email, then a code by text."
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-500 dark:text-brand-400">
            Sign in
          </Link>
        </>
      }
    >
      <ResetFlow />
    </AuthShell>
  );
}
