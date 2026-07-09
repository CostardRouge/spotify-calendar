"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { PlaybackState } from "@/lib/spotify";
import type { PlayerErrorKind } from "@/lib/playerClient";

const POLL_MS = 5000;

/**
 * Single source of truth for "what's playing", polled from /api/player and
 * shared across the app. The MiniPlayer renders it; play/queue buttons read
 * `isPlaying` to decide whether to queue an item or start it. Centralising the
 * poll here means there's exactly one request loop no matter how many consumers.
 */
interface PlaybackContextValue {
  state: PlaybackState | null;
  /** True only when a track is actively playing (paused / idle → false). */
  isPlaying: boolean;
  refresh: () => void;
  setState: Dispatch<SetStateAction<PlaybackState | null>>;
}

const PlaybackContext = createContext<PlaybackContextValue | null>(null);

export function usePlayback(): PlaybackContextValue {
  const ctx = useContext(PlaybackContext);
  if (!ctx) throw new Error("usePlayback must be used within PlaybackProvider");
  return ctx;
}

export default function PlaybackProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<PlaybackState | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/player", { cache: "no-store" });
      if (res.status === 401) {
        setState(null);
        // Distinguish scope drift (missing playback scopes) from a plain expired
        // session so the MiniPlayer can prompt a reconnect rather than sit empty.
        try {
          const kind = (await res.json())?.error as PlayerErrorKind | undefined;
          if (kind === "reauth_required") {
            window.dispatchEvent(
              new CustomEvent<PlayerErrorKind>("player:error", {
                detail: "reauth_required",
              }),
            );
          }
        } catch {
          /* ignore */
        }
        return;
      }
      if (!res.ok) return;
      const { state: s } = (await res.json()) as { state: PlaybackState | null };
      setState(s);
    } catch {
      /* transient — keep last state */
    }
  }, []);

  // Poll while the tab is visible.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (timer) return;
      refresh();
      timer = setInterval(refresh, POLL_MS);
    };
    const stopPolling = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVis = () =>
      document.visibilityState === "visible" ? startPolling() : stopPolling();

    startPolling();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  // A play/queue button elsewhere just changed playback — re-poll promptly.
  useEffect(() => {
    const onChanged = () => setTimeout(refresh, 400);
    window.addEventListener("player:changed", onChanged);
    return () => window.removeEventListener("player:changed", onChanged);
  }, [refresh]);

  const isPlaying = !!state?.isPlaying;

  return (
    <PlaybackContext.Provider value={{ state, isPlaying, refresh, setState }}>
      {children}
    </PlaybackContext.Provider>
  );
}
