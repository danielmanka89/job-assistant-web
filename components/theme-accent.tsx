"use client";

import { useEffect } from "react";
import { useCurrentUser } from "@/lib/client/current-user";
import { accentFor } from "@/lib/theme-color";
import type { ThemeColor } from "@/lib/types";

// Keeps data-accent on <html> in step with the signed-in candidate's theme color when it changes in
// Settings or the user signs out. ACCENT_INIT_SCRIPT (lib/theme-color.ts) sets it before first paint.
export function ThemeAccent() {
  const user = useCurrentUser();
  // Users saved before the theme color moved off the clocks still carry clockColor.
  const color = user ? (user.themeColor ?? (user as { clockColor?: ThemeColor }).clockColor) : undefined;
  useEffect(() => {
    if (user === undefined) return; // still on the server's first render: keep what the init script set
    const accent = accentFor(color);
    if (accent !== "red") document.documentElement.dataset.accent = accent;
    else delete document.documentElement.dataset.accent; // red is the default
  }, [user, color]);
  return null;
}
