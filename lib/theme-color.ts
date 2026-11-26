import { RING_STYLES, THEME_COLORS, type RingStyle, type ThemeColor } from "@/lib/types";

/** A stored ring style, or the default Prism ring for anything unknown. */
export const ringStyleOf = (value: unknown): RingStyle => (RING_STYLES.includes(value as RingStyle) ? (value as RingStyle) : "PRISM");

/**
 * The theme color stored for an account, as one of today's three. Accounts saved with the earlier
 * colors keep their feel: Blue (and anything unknown) is Midnight Navy, Green is Deep Teal, Red is Dusky Plum.
 */
export function themeColorOf(value: unknown): ThemeColor {
  if (THEME_COLORS.includes(value as ThemeColor)) return value as ThemeColor;
  return value === "GREEN" ? "TEAL" : value === "RED" ? "PLUM" : "NAVY";
}

export type Accent = "navy" | "teal" | "plum" | "graphite";

/** The data-accent value for a theme color (globals.css). Navy is the default, so it can be left off. */
export const accentFor = (color: unknown): Accent => {
  const theme = themeColorOf(color);
  return theme === "TEAL" ? "teal" : theme === "PLUM" ? "plum" : theme === "GRAPHITE" ? "graphite" : "navy";
};

/** The deep menu color of each theme: the phone's status bar and browser toolbar use it (theme-color). */
export const MENU_COLOR: Record<Accent, string> = { navy: "#33435e", teal: "#3f6f6c", plum: "#6e5872", graphite: "#26313a" };

// Read from the user saved at login, so the root layout can set data-accent (and the phone's bar
// color) before the first paint. Lives here, not in a "use client" module, so the server layout gets the string.
const USER_KEY = "job-assistant.user";
export const ACCENT_INIT_SCRIPT = `try{var u=JSON.parse(localStorage.getItem(${JSON.stringify(USER_KEY)})||"null"),c=u&&(u.themeColor||u.clockColor),a=c==="TEAL"||c==="GREEN"?"teal":c==="PLUM"||c==="RED"?"plum":c==="GRAPHITE"?"graphite":null,bars=${JSON.stringify(MENU_COLOR)};if(a){document.documentElement.dataset.accent=a;var m=document.querySelector('meta[name="theme-color"]');if(m)m.content=bars[a]}}catch(e){}`;
