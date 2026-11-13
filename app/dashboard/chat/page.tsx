import type { Metadata } from "next";
import { ChatView } from "./chat-view";

export const metadata: Metadata = { title: "Chat" };

/** ?c=<chat id> opens that conversation straight away (the dashboard's Recent chats link here). */
export default async function ChatPage({ searchParams }: { searchParams: Promise<{ c?: string | string[] }> }) {
  const { c } = await searchParams;
  const openChat = typeof c === "string" && c.length <= 100 ? c : null;
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-6 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl dark:text-white">Chat</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-neutral-500 dark:text-neutral-400">
          Connect with friends, vendors, employers and recruiters, and message the people you&apos;re connected with.
        </p>
      </div>
      <ChatView initialOpenId={openChat} />
    </main>
  );
}
