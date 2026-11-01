import type { Metadata } from "next";
import { ProfileEditor } from "./profile-editor";

export const metadata: Metadata = { title: "My Profile" };

export default function ProfilePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl dark:text-white">My Profile</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-neutral-500 dark:text-neutral-400">
          Fill this in once. It&apos;s saved to your account and used automatically every time you apply to a job
          or tailor your resume.
        </p>
      </div>
      <ProfileEditor />
    </main>
  );
}
