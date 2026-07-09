"use client";

import { useState } from "react";
import type { Album } from "@/lib/types";
import { usePlayback } from "@/components/PlaybackProvider";
import { playItem, queueItem, itemToUri } from "@/lib/playerClient";

/** Build the play/queue request for a library item (album context vs track uri). */
function reqFor(item: Album) {
  return item.kind === "track"
    ? { uris: [itemToUri(item.id, "track")] }
    : { contextUri: itemToUri(item.id, "album") };
}

/**
 * Start an item now, replacing whatever is playing. Always available — this is
 * the "play" half of the pair, meant to sit on the cover art.
 */
export function PlayButton({
  item,
  className,
}: {
  item: Album;
  className: string;
}) {
  const noun = item.kind === "track" ? "song" : "album";
  return (
    <button
      className={className}
      title={`Play ${noun} now`}
      aria-label={`Play ${noun} now`}
      onClick={(e) => {
        e.stopPropagation();
        playItem(reqFor(item));
      }}
    >
      ▶
    </button>
  );
}

/**
 * Add an item to the end of the queue. Disabled while nothing is playing, since
 * Spotify's queue needs an active device — the tooltip explains why.
 */
type QueueStatus = "idle" | "loading" | "success" | "error";

export function QueueButton({
  item,
  className,
}: {
  item: Album;
  className: string;
}) {
  const { isPlaying } = usePlayback();
  const [status, setStatus] = useState<QueueStatus>("idle");
  const noun = item.kind === "track" ? "song" : "album";
  const label = isPlaying
    ? `Add ${noun} to queue`
    : "Start playing something first to add to the queue";

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    // Guard re-entry while a request is in flight (button stays enabled during
    // loading so its animation isn't dimmed by the disabled styling).
    if (!isPlaying || status === "loading") return;
    setStatus("loading");
    const ok = await queueItem(reqFor(item));
    setStatus(ok ? "success" : "error");
    // Return to the resting "+" after the confirmation/failure flash.
    setTimeout(() => setStatus("idle"), 1200);
  }

  // Inline SVG (not a text glyph) so the mark is geometrically centred in the
  // circle regardless of font metrics.
  const iconPath =
    status === "success"
      ? "M5 12.5l4.5 4.5L19 7" // check
      : status === "error"
        ? "M6.5 6.5l11 11M17.5 6.5l-11 11" // cross
        : "M12 5.5v13M5.5 12h13"; // plus

  return (
    <button
      className={className}
      data-status={status}
      title={label}
      aria-label={label}
      disabled={!isPlaying}
      onClick={handleClick}
    >
      <svg className="qicon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d={iconPath}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
