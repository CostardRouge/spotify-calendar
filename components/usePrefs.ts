"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  DEFAULTS,
  MONTH_LAYOUTS,
  PREF_KEYS,
  THEMES,
  WALL_ORDERS,
  applyTheme,
  loadChoice,
  saveChoice,
  type MonthLayout,
  type Theme,
  type WallOrder,
} from "@/lib/prefs";

/**
 * The device's remembered choices (lib/prefs.ts) as one tiny store, so the
 * account button in the side rail and the one in the phone header — two
 * mounted menus, one visible at a time — never disagree after a resize.
 */
interface Prefs {
  theme: Theme;
  monthLayout: MonthLayout;
  wallOrder: WallOrder;
  wallHintSeen: boolean;
}

let state: Prefs = { ...DEFAULTS, wallHintSeen: true };
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded) return;
  loaded = true;
  let hint = false;
  try {
    hint = localStorage.getItem(PREF_KEYS.wallHint) === "1";
  } catch {
    hint = true; // no storage: never nag on every load
  }
  state = {
    theme: loadChoice(PREF_KEYS.theme, THEMES, DEFAULTS.theme),
    monthLayout: loadChoice(PREF_KEYS.monthLayout, MONTH_LAYOUTS, DEFAULTS.monthLayout),
    wallOrder: loadChoice(PREF_KEYS.wallOrder, WALL_ORDERS, DEFAULTS.wallOrder),
    wallHintSeen: hint,
  };
  // The head script set data-theme already; this brings the theme-color metas along.
  applyTheme(state.theme);
  listeners.forEach((l) => l());
}

function set(patch: Partial<Prefs>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => state;
// The server knows nothing of this device: it renders the defaults, with the
// one-time wall explanation held back until the stored answer is known.
const serverSnapshot = (): Prefs => ({ ...DEFAULTS, wallHintSeen: true });

export function usePrefs() {
  const prefs = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  useEffect(load, []);

  const setTheme = useCallback((theme: Theme) => {
    saveChoice(PREF_KEYS.theme, theme);
    applyTheme(theme);
    set({ theme });
  }, []);
  const setMonthLayout = useCallback((monthLayout: MonthLayout) => {
    saveChoice(PREF_KEYS.monthLayout, monthLayout);
    set({ monthLayout });
  }, []);
  const setWallOrder = useCallback((wallOrder: WallOrder) => {
    saveChoice(PREF_KEYS.wallOrder, wallOrder);
    set({ wallOrder });
  }, []);
  const dismissWallHint = useCallback(() => {
    saveChoice(PREF_KEYS.wallHint, "1");
    set({ wallHintSeen: true });
  }, []);

  return { ...prefs, setTheme, setMonthLayout, setWallOrder, dismissWallHint };
}
