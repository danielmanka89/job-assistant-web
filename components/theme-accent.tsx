"use client";

import { useEffect } from "react";
import { useCurrentUser } from "@/lib/client/current-user";
import { MENU_COLOR, accentFor } from "@/lib/theme-color";

// Keeps data-accent on <html> in step with the signed-in candidate's theme color when it changes in
// Settings or the user signs out, and the phone's status bar / browser toolbar color (theme-color)
// with it. ACCENT_INIT_SCRIPT (lib/theme-color.ts) sets both before first paint.
export function ThemeAccent() {
  const user = useCurrentUser();
  // Users saved before the theme color moved off the clocks still carry clockColor.
  const color = user ? (user.themeColor ?? (user as { clockColor?: unknown }).clockColor) : undefined;
  useEffect(() => {
    if (user === undefined) return; // still on the server's first render: keep what the init script set
    const accent = accentFor(color);
    if (accent !== "navy") document.documentElement.dataset.accent = accent;
    else delete document.documentElement.dataset.accent; // navy is the default
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", MENU_COLOR[accent]);
  }, [user, color]);
  return null;
}
