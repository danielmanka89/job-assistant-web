import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { inviterFor } from "@/lib/invite";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const { invite } = await searchParams;
  // Opened from a friend's invite link: say who invited them. Signing up connects the two of you.
  const inviter = await inviterFor(Array.isArray(invite) ? invite[0] : invite);
  return (
    <AuthShell
      title={inviter ? `${inviter.name.split(" ")[0]} invited you` : "Create your account"}
      subtitle={inviter ? `Create your account and you and ${inviter.name} will be connected, ready to chat.` : "Upload your resume and start matching it to jobs."}
      footer={
        <>
          Already have an account?{" "}
          <Link href={inviter ? `/login?invite=${encodeURIComponent((Array.isArray(invite) ? invite[0] : invite) ?? "")}` : "/login"} className="font-semibold text-brand-600 hover:text-brand-500 dark:text-brand-400">
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
