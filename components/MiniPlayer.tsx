"use client";

import { useEffect, useRef, useState } from "react";
import type { Device, QueueState, QueueTrack } from "@/lib/spotify";
import { usePlayback } from "@/components/PlaybackProvider";
import {
  type PlayRequest,
  type PlayerErrorKind,
  pausePlayback,
  resumePlayback,
  nextTrack,
  previousTrack,
  playItem,
  fetchQueue,
  deepLinkToSpotify,
} from "@/lib/playerClient";

const ERROR_TEXT: Record<PlayerErrorKind, string> = {
  unauthorized: "Session expired — please sign in again.",
  reauth_required: "Reconnect Spotify to enable playback (sign out and back in).",
  premium_required: "Playback control requires Spotify Premium.",
  no_active_device: "No active Spotify device.",
  rate_limited: "Spotify is rate-limiting — try again shortly.",
  player_failed: "Couldn't reach Spotify. Try again.",
};

export default function MiniPlayer() {
  // Playback state comes from the shared provider (single poll for the whole
  // app). We keep the setter so play/pause can update optimistically.
  const { state, setState, refresh } = usePlayback();
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [pendingReq, setPendingReq] = useState<PlayRequest | null>(null);

  // Queue panel: what's playing now + what's coming up.
  const [queueOpen, setQueueOpen] = useState(false);
  const [queue, setQueue] = useState<QueueState | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);

  // Local progress ticking between polls, so the bar moves smoothly.
  const [tick, setTick] = useState(0);
  const baseRef = useRef<{ progressMs: number; at: number; playing: boolean }>({
    progressMs: 0,
    at: Date.now(),
    playing: false,
  });

  // Re-anchor the smooth-progress base whenever fresh state lands from the poll.
  useEffect(() => {
    baseRef.current = {
      progressMs: state?.progressMs ?? 0,
      at: Date.now(),
      playing: !!state?.isPlaying,
    };
  }, [state]);

  // Smooth progress bar: re-render ~2x/sec; actual value computed from baseRef.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  // React to events from playerClient (play/queue buttons elsewhere in the app).
  useEffect(() => {
    const onNeedDevice = (e: Event) => {
      const detail = (e as CustomEvent<PlayRequest>).detail;
      setPendingReq(detail ?? null);
      openDevicePicker();
    };
    const onError = (e: Event) => {
      const kind = (e as CustomEvent<PlayerErrorKind>).detail;
      setError(ERROR_TEXT[kind] ?? ERROR_TEXT.player_failed);
    };
    window.addEventListener("player:needdevice", onNeedDevice);
    window.addEventListener("player:error", onError);
    return () => {
      window.removeEventListener("player:needdevice", onNeedDevice);
      window.removeEventListener("player:error", onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openDevicePicker() {
    setError(null);
    setQueueOpen(false); // don't stack the two popovers
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

  async function loadQueue() {
    setQueueLoading(true);
    const q = await fetchQueue();
    setQueue(q);
    setQueueLoading(false);
  }

  function toggleQueue() {
    const next = !queueOpen;
    setQueueOpen(next);
    if (next) {
      setDevices(null); // don't stack the two popovers
      loadQueue();
    }
  }

  // Play a queued item now. Refetch the queue immediately (rather than waiting
  // for the poll) so the panel reflects the new now-playing without a lag.
  async function playFromQueue(track: QueueTrack) {
    const ok = await playItem({ uris: [track.uri] });
    if (ok) {
      refresh();
      setTimeout(loadQueue, 500); // give Spotify a beat to advance the queue
    }
  }

  // Keep an open queue panel fresh as the track advances.
  useEffect(() => {
    if (queueOpen) loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.track?.id]);

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
              className="mp-btn mp-queue-btn"
              onClick={toggleQueue}
              data-open={queueOpen ? "true" : undefined}
              title="Queue"
              aria-label="Show queue"
            >
              <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                <path
                  d="M4 7h11M4 12h11M4 17h7M16 12.5v6l4.5-3-4.5-3z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
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

      {queueOpen && (
        <div className="mp-queue">
          <div className="mp-devices-head">
            <span>Queue</span>
            <button
              className="mp-x"
              onClick={() => setQueueOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="mp-queue-scroll">
            {queueLoading && !queue ? (
              <div className="mp-queue-empty">Loading…</div>
            ) : queue && (queue.nowPlaying || queue.upNext.length > 0) ? (
              <>
                {queue.nowPlaying && (
                  <div className="mp-queue-section">
                    <div className="mp-queue-label">Now playing</div>
                    <QueueRow track={queue.nowPlaying} active />
                  </div>
                )}
                {queue.upNext.length > 0 && (
                  <div className="mp-queue-section">
                    <div className="mp-queue-label">Up next</div>
                    {queue.upNext.map((t, i) => (
                      <QueueRow
                        key={`${t.uri}-${i}`}
                        track={t}
                        onPlay={playFromQueue}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="mp-queue-empty">Nothing in the queue</div>
            )}
          </div>
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

/**
 * One row in the queue panel: cover + title/artist, highlighted when active.
 * When `onPlay` is provided, hovering the cover reveals a play button that
 * starts that item immediately.
 */
function QueueRow({
  track,
  active,
  onPlay,
}: {
  track: QueueTrack;
  active?: boolean;
  onPlay?: (track: QueueTrack) => void;
}) {
  return (
    <div className="mp-queue-row" data-active={active ? "true" : undefined}>
      <div className="mp-queue-cover-wrap">
        {track.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="mp-queue-cover" src={track.cover} alt="" />
        ) : (
          <div className="mp-queue-cover mp-cover-empty" />
        )}
        {onPlay && (
          <button
            className="mp-queue-play"
            title="Play now"
            aria-label={`Play ${track.name} now`}
            onClick={() => onPlay(track)}
          >
            ▶
          </button>
        )}
      </div>
      <div className="mp-queue-info">
        <div className="mp-queue-name" title={track.name}>
          {track.name}
        </div>
        <div className="mp-queue-artist" title={track.artists}>
          {track.artists}
        </div>
      </div>
    </div>
  );
}
