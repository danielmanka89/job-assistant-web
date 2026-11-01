import type { Metadata } from "next";
import { ProfileView } from "./profile-view";

export const metadata: Metadata = { title: "My Profile" };

export default function ProfilePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl dark:text-white">My Profile</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-neutral-500 dark:text-neutral-400">
          Filled in from your resume and used automatically every time you apply to a job or tailor your resume.
          To change it, upload an updated resume.
        </p>
      </div>
      <ProfileView />
    </main>
  );
}
