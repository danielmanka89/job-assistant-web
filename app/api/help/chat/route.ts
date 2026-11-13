import Anthropic from "@anthropic-ai/sdk";
import type { NextRequest } from "next/server";
import { apiError, readJsonObject } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { helpGuideText, pageName } from "@/lib/help-content";

// The help assistant (the "?" button on every dashboard page, and Ask in Settings › Help Center).
// It answers only questions about using this app, from the guides in lib/help-content.ts.

const MODEL = "claude-opus-5-5";
const MAX_TURNS = 20; // messages kept from the conversation
const MAX_QUESTION_CHARS = 2000;
const MAX_ANSWER_CHARS = 8000;
const LIMIT = 30; // questions per account…
const WINDOW_MS = 10 * 60 * 1000; // …per 10 minutes (per server instance: a soft guard, not billing control)

const SYSTEM = `You are the Help assistant inside JobAssistant, a web app that helps job seekers tailor their resume to each job, track applications, prepare for interviews and grow their skills, and helps employers post jobs.

Your only job is to explain how to use this app. Answer questions about its pages, features, steps, settings and common problems, using the guide below as your source of facts.

- If the guide doesn't cover something about the app, say you're not sure rather than guessing, and suggest the Help Center in Settings. Never invent features, buttons, limits or pages.
- If the question isn't about using this app (general knowledge, coding, writing a cover letter for them, career or legal advice, other websites), say in one friendly sentence that you can only help with JobAssistant, and offer a related thing you can help with in the app.
- You can't see or change the person's data or settings and can't take actions for them; tell them where to do it themselves.
- Never ask for passwords or other private details.
- Keep answers short: two to five sentences, or a short numbered list for steps. Your answers may be read aloud, so write plain sentences: no markdown headings, tables, bold, links or emoji. Name pages and buttons exactly as the guide does.
- Reply in the language the person writes in.

# Guide to JobAssistant

${helpGuideText()}`;

let client: Anthropic | undefined;
const recent = new Map<string, number[]>();

type Turn = { role: "user" | "assistant"; content: string };

/** The conversation from the request, or an error message. */
function readTurns(value: unknown): Turn[] | string {
  if (!Array.isArray(value) || value.length === 0) return "Ask a question first";
  const turns = value.slice(-MAX_TURNS);
  const out: Turn[] = [];
  for (const t of turns) {
    const role = (t as { role?: unknown })?.role;
    const content = (t as { content?: unknown })?.content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string" || !content.trim()) return "Each message needs a role and text";
    if (content.length > (role === "user" ? MAX_QUESTION_CHARS : MAX_ANSWER_CHARS)) return `Questions can be at most ${MAX_QUESTION_CHARS} characters`;
    // Merge accidental repeats of the same role so the conversation alternates.
    const last = out[out.length - 1];
    if (last?.role === role) last.content += `\n\n${content.trim()}`;
    else out.push({ role, content: content.trim() });
  }
  while (out[0]?.role === "assistant") out.shift(); // the history must start with a question
  if (out[out.length - 1]?.role !== "user") return "The last message must be your question";
  return out.length ? out : "Ask a question first";
}

/** True when this account has asked too many questions recently. */
function overLimit(userId: string, now = Date.now()): boolean {
  const times = (recent.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (times.length >= LIMIT) {
    recent.set(userId, times);
    return true;
  }
  times.push(now);
  recent.set(userId, times);
  return false;
}

/**
 * POST /api/help/chat { messages: [{ role, content }], page? } — streams the assistant's answer as plain
 * text. Errors before the answer starts come back as JSON (ApiError) with a status code.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to use the help assistant");
  if (!process.env.ANTHROPIC_API_KEY) return apiError(503, "AI_NOT_CONFIGURED", "The help assistant isn't set up on this server yet. The Help Center in Settings has all the guides.");

  const body = await readJsonObject(request);
  if (!body) return apiError(400, "INVALID_JSON", "Request body must be a JSON object");
  const turns = readTurns(body.messages);
  if (typeof turns === "string") return apiError(400, "VALIDATION_ERROR", turns);
  if (overLimit(user.id)) return apiError(429, "HELP_LIMIT_REACHED", "You've asked a lot of questions in a short time. Please wait a few minutes and try again.");

  const page = typeof body.page === "string" && body.page.startsWith("/") ? pageName(body.page.slice(0, 200)) : null;
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 4000,
    // If the model declines, the API retries on its default fallback model in the same call.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" }, // quick, conversational answers
    system: [
      // The guide is the same for every question, so it's cached; where the person is comes after it.
      { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
      ...(page ? [{ type: "text" as const, text: `The person is currently on this page: ${page}.` }] : []),
    ],
    messages: turns,
  });

  const encoder = new TextEncoder();
  const answer = new ReadableStream<Uint8Array>({
    async start(controller) {
      let wrote = false;
      stream.on("text", (delta) => {
        wrote = true;
        controller.enqueue(encoder.encode(delta));
      });
      try {
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal" && !wrote) {
          controller.enqueue(encoder.encode("Sorry, I can't help with that. I can answer questions about using JobAssistant."));
        } else if (final.stop_reason === "max_tokens") {
          controller.enqueue(encoder.encode("…"));
        }
      } catch (error) {
        const reason =
          error instanceof Anthropic.RateLimitError
            ? "The assistant is busy right now."
            : error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError
              ? "The assistant isn't set up correctly on this server."
              : "The assistant stopped unexpectedly.";
        console.error("help chat failed", error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : error);
        controller.enqueue(encoder.encode(`${wrote ? "\n\n" : ""}${reason} Please try again in a moment, or look in the Help Center in Settings.`));
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort(); // the person closed the chat or navigated away
    },
  });

  return new Response(answer, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
