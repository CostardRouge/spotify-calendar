/**
 * Choices this device remembers: the theme, how the month is laid out (the
 * wall or the calendar grid) and which way the wall runs. Per device, not per
 * Spotify account and not in the URL: they are about the screen in hand, and
 * a shared link should open in the reader's own theme and layout.
 *
 * Storage is touched only inside functions, never at import time, so the
 * parsing stays testable under Node (tests/prefs.test.ts).
 */

export const THEMES = ["auto", "night", "day"] as const;
export type Theme = (typeof THEMES)[number];

export const MONTH_LAYOUTS = ["wall", "grid"] as const;
export type MonthLayout = (typeof MONTH_LAYOUTS)[number];

/** "asc": the 1st first, like a calendar — the default; "desc": newest first. */
export const WALL_ORDERS = ["asc", "desc"] as const;
export type WallOrder = (typeof WALL_ORDERS)[number];

export const PREF_KEYS = {
  theme: "slc_theme",
  monthLayout: "slc_month_layout",
  wallOrder: "slc_wall_order",
  /** Set once the wall's one-time explanation has been dismissed. */
  wallHint: "slc_wall_hint_seen",
} as const;

export const DEFAULTS = {
  theme: "auto" as Theme,
  monthLayout: "wall" as MonthLayout,
  wallOrder: "asc" as WallOrder,
};

/** `raw` when it is one of `allowed`, else `fallback` — storage holds strings anyone can edit. */
export function parseChoice<T extends string>(
  raw: string | null | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  return raw != null && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

/** Reads a stored choice; a private window or a full quota reads as the default. */
export function loadChoice<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    return parseChoice(localStorage.getItem(key), allowed, fallback);
  } catch {
    return fallback;
  }
}

export function saveChoice(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not remembered on this device; the choice still applies until reload.
  }
}

/** The night and day backgrounds, for the browser chrome (`theme-color`). */
const CHROME = { night: "#15110e", day: "#f6f1ea" } as const;

/**
 * Applies a theme to the page: `data-theme` on <html> forces night or day over
 * the device's setting (app/globals.css); "auto" removes it. The theme-color
 * metas follow, or the status bar of an installed app keeps the other colour.
 */
export function applyTheme(theme: Theme): void {
  const el = document.documentElement;
  if (theme === "auto") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", theme);
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    const media = m.getAttribute("media") ?? "";
    const own = media.includes("light") ? CHROME.day : CHROME.night;
    m.content = theme === "auto" ? own : CHROME[theme];
  });
}

/**
 * Runs in <head> before the first paint (app/layout.tsx): a forced theme is on
 * <html> before anything is drawn, so a day-theme reader on a night-set phone
 * never sees a flash of night. Kept as a string because it is inlined.
 */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(PREF_KEYS.theme)});if(t==="night"||t==="day")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
