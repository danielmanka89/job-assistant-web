import type { Metadata } from "next";
import { ChatView } from "./chat-view";

export const metadata: Metadata = { title: "Chat" };

export default function ChatPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-6 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl dark:text-white">Chat</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-neutral-500 dark:text-neutral-400">
          Connect with friends, vendors, employers and recruiters, and message the people you&apos;re connected with.
        </p>
      </div>
      <ChatView />
    </main>
  );
}
