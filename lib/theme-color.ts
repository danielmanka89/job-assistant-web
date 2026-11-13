import type { ThemeColor } from "@/lib/types";

/** The data-accent value for a theme color (globals.css). Blue is the default, so it can be left off. */
export const accentFor = (color: ThemeColor | null | undefined): "red" | "blue" | "green" =>
  color === "RED" ? "red" : color === "GREEN" ? "green" : "blue";

// Read from the user saved at login, so the root layout can set data-accent before the first paint
// (no flash of the default blue). Lives here, not in a "use client" module, so the server layout gets the string.
const USER_KEY = "job-assistant.user";
export const ACCENT_INIT_SCRIPT = `try{var u=JSON.parse(localStorage.getItem(${JSON.stringify(USER_KEY)})||"null"),c=u&&(u.themeColor||u.clockColor);if(c==="RED"||c==="GREEN")document.documentElement.dataset.accent=c.toLowerCase()}catch(e){}`;
