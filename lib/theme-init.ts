// Shared with the root layout, so it can't live in a "use client" module: the server would get a
// client reference instead of these values, and the inline script would be an error message.
export const THEME_STORAGE_KEY = "job-assistant.theme";
export const THEMES = ["light", "dark", "mono"] as const;

/** Applies the saved light / dark / black & white choice before the first paint. */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(${JSON.stringify(THEMES)}.indexOf(t)>=0)document.documentElement.dataset.theme=t}catch(e){}`;
