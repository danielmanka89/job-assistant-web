"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { User } from "@/lib/types";

// The session cookie is HTTP-only, so the browser can't read who is logged in.
// Login and register return the user; we keep it here to adjust the UI (for
// example the employer link). The API still enforces roles on every request.
const KEY = "job-assistant.user";
const CHANGE_EVENT = "job-assistant:user-change";

export function storeUser(user: User): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(user));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Storage unavailable: the UI falls back to seeker defaults and the API decides.
  }
}

export function clearUser(): void {
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // ignore
  }
}

export function readStoredUser(): User | null {
  return parseUser(readRaw());
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function parseUser(raw: string | null): User | null {
  if (!raw) return null;
  try {
    const user = JSON.parse(raw) as User;
    return user && typeof user.id === "string" && (user.role === "SEEKER" || user.role === "EMPLOYER") ? user : null;
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) onChange();
  };
  window.addEventListener("storage", onStorage); // other tabs
  window.addEventListener(CHANGE_EVENT, onChange); // this tab
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/**
 * The logged-in user as of the last login or register in this browser.
 * `undefined` while rendering on the server, `null` if unknown (for example a
 * session from before roles existed).
 */
export function useCurrentUser(): User | null | undefined {
  const raw = useSyncExternalStore<string | null | undefined>(subscribe, readRaw, () => undefined);
  return useMemo(() => (raw === undefined ? undefined : parseUser(raw)), [raw]);
}
