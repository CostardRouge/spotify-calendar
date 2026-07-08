"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PlaybackState, Device } from "@/lib/spotify";
import {
  type PlayRequest,
  type PlayerErrorKind,
  pausePlayback,
  resumePlayback,
  nextTrack,
  previousTrack,
  playItem,
  deepLinkToSpotify,
} from "@/lib/playerClient";

const POLL_MS = 5000;

const ERROR_TEXT: Record<PlayerErrorKind, string> = {
  unauthorized: "Session expired — please sign in again.",
  reauth_required: "Reconnect Spotify to enable playback (sign out and back in).",
  premium_required: "Playback control requires Spotify Premium.",
  no_active_device: "No active Spotify device.",
  rate_limited: "Spotify is rate-limiting — try again shortly.",
  player_failed: "Couldn't reach Spotify. Try again.",
};

export default function MiniPlayer() {
  const [state, setState] = useState<PlaybackState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [pendingReq, setPendingReq] = useState<PlayRequest | null>(null);

  // Local progress ticking between polls, so the bar moves smoothly.
  const [tick, setTick] = useState(0);
  const baseRef = useRef<{ progressMs: number; at: number; playing: boolean }>({
    progressMs: 0,
    at: Date.now(),
    playing: false,
  });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/player", { cache: "no-store" });
      if (res.status === 401) {
        setState(null);
        // Distinguish scope drift (grant missing playback scopes) from a plain
        // expired session, so the user is told to reconnect rather than staring
        // at an empty player.
        try {
          const kind = (await res.json())?.error as PlayerErrorKind | undefined;
          if (kind === "reauth_required") setError(ERROR_TEXT.reauth_required);
        } catch {
          /* ignore */
        }
        return;
      }
      if (!res.ok) return;
      const { state: s } = (await res.json()) as { state: PlaybackState | null };
      setState(s);
      baseRef.current = {
        progressMs: s?.progressMs ?? 0,
        at: Date.now(),
        playing: !!s?.isPlaying,
      };
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

  // Smooth progress bar: re-render ~2x/sec; actual value computed from baseRef.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  // React to events from playerClient (play buttons elsewhere in the app).
  useEffect(() => {
    const onChanged = () => setTimeout(refresh, 400);
    const onNeedDevice = (e: Event) => {
      const detail = (e as CustomEvent<PlayRequest>).detail;
      setPendingReq(detail ?? null);
      openDevicePicker();
    };
    const onError = (e: Event) => {
      const kind = (e as CustomEvent<PlayerErrorKind>).detail;
      setError(ERROR_TEXT[kind] ?? ERROR_TEXT.player_failed);
    };
    window.addEventListener("player:changed", onChanged);
    window.addEventListener("player:needdevice", onNeedDevice);
    window.addEventListener("player:error", onError);
    return () => {
      window.removeEventListener("player:changed", onChanged);
      window.removeEventListener("player:needdevice", onNeedDevice);
      window.removeEventListener("player:error", onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  async function openDevicePicker() {
    setError(null);
    try {
      const res = await fetch("/api/player/devices", { cache: "no-store" });
      if (!res.ok) {
        setError(ERROR_TEXT.player_failed);
        return;
      }
      const { devices: d } = (await res.json()) as { devices: Device[] };
      setDevices(d);
      if (d.length === 0) {
        // Nothing to control — offer to open the native app.
        setError("No devices found. Open Spotify, then try again.");
      }
    } catch {
      setError(ERROR_TEXT.player_failed);
    }
  }

  async function chooseDevice(deviceId: string) {
    setError(null);
    try {
      if (pendingReq) {
        // Retry the original play request against the chosen device.
        await playItem({ ...pendingReq, deviceId });
      } else {
        // Just move playback there.
        await fetch("/api/player/transfer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId, play: true }),
        });
      }
    } finally {
      setDevices(null);
      setPendingReq(null);
      setTimeout(refresh, 600);
    }
  }

  async function togglePlayPause() {
    if (!state) return;
    setError(null);
    // optimistic
    setState({ ...state, isPlaying: !state.isPlaying });
    baseRef.current.playing = !baseRef.current.playing;
    baseRef.current.at = Date.now();
    const res = await (state.isPlaying ? pausePlayback() : resumePlayback());
    if (!res.ok) await handleControlError(res);
    setTimeout(refresh, 500);
  }

  async function skip(dir: "next" | "previous") {
    setError(null);
    const res = await (dir === "next" ? nextTrack() : previousTrack());
    if (!res.ok) await handleControlError(res);
    setTimeout(refresh, 500);
  }

  async function handleControlError(res: Response) {
    let kind: PlayerErrorKind = "player_failed";
    try {
      kind = (await res.json())?.error ?? kind;
    } catch {
      /* ignore */
    }
    if (kind === "no_active_device") {
      openDevicePicker();
    } else {
      setError(ERROR_TEXT[kind] ?? ERROR_TEXT.player_failed);
    }
  }

  // Derived progress (uses tick to recompute without storing per-frame state).
  void tick;
  const base = baseRef.current;
  const elapsed = base.playing ? Date.now() - base.at : 0;
  const progressMs = Math.min(
    base.progressMs + elapsed,
    state?.durationMs ?? Number.MAX_SAFE_INTEGER,
  );
  const pct =
    state?.durationMs && state.durationMs > 0
      ? Math.min(100, (progressMs / state.durationMs) * 100)
      : 0;

  const hasTrack = !!state?.track;

  return (
    <div className="mini-player" data-empty={hasTrack ? undefined : "true"}>
      {hasTrack ? (
        <>
          {state!.track!.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="mp-cover"
              src={state!.track!.cover}
              alt={state!.track!.album}
            />
          ) : (
            <div className="mp-cover mp-cover-empty" />
          )}
          <div className="mp-meta">
            <div className="mp-title" title={state!.track!.name}>
              {state!.track!.name}
            </div>
            <div className="mp-artist" title={state!.track!.artists}>
              {state!.track!.artists}
            </div>
            <div className="mp-bar">
              <div className="mp-bar-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="mp-controls">
            <button
              className="mp-btn"
              onClick={() => skip("previous")}
              title="Previous"
              aria-label="Previous track"
            >
              ⏮
            </button>
            <button
              className="mp-btn mp-play"
              onClick={togglePlayPause}
              title={state!.isPlaying ? "Pause" : "Play"}
              aria-label={state!.isPlaying ? "Pause" : "Play"}
            >
              {state!.isPlaying ? "❚❚" : "▶"}
            </button>
            <button
              className="mp-btn"
              onClick={() => skip("next")}
              title="Next"
              aria-label="Next track"
            >
              ⏭
            </button>
            <button
              className="mp-btn mp-dev"
              onClick={openDevicePicker}
              title="Devices"
              aria-label="Choose device"
            >
              ⧉
            </button>
          </div>
        </>
      ) : (
        <div className="mp-idle">
          <span className="mp-idle-text">Nothing playing</span>
          <button className="mp-btn mp-dev" onClick={openDevicePicker} title="Devices">
            Devices
          </button>
        </div>
      )}

      {error && (
        <div className="mp-error" role="status">
          {error}
          <button className="mp-x" onClick={() => setError(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      {devices && (
        <div className="mp-devices">
          <div className="mp-devices-head">
            <span>Play on…</span>
            <button className="mp-x" onClick={() => setDevices(null)} aria-label="Close">
              ×
            </button>
          </div>
          {devices.length === 0 ? (
            <button
              className="mp-device-row"
              onClick={() => deepLinkToSpotify("spotify:")}
            >
              Open Spotify app
            </button>
          ) : (
            devices.map((d) => (
              <button
                key={d.id}
                className="mp-device-row"
                data-active={d.isActive ? "true" : undefined}
                disabled={d.isRestricted}
                onClick={() => chooseDevice(d.id)}
              >
                <span className="mp-device-name">{d.name}</span>
                <span className="mp-device-type">{d.type}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
