"use client";

import type { Album } from "@/lib/types";
import { spotifyUrl } from "@/lib/playerClient";
import { PlayButton, QueueButton } from "@/components/PlayQueueButton";

export default function DayModal({
  dateKey,
  albums,
  onClose,
}: {
  dateKey: string;
  albums: Album[];
  onClose: () => void;
}) {
  const d = new Date(dateKey + "T00:00:00");
  const title = d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const sorted = [...albums].sort(
    (a, b) => +new Date(b.addedAt) - +new Date(a.addedAt),
  );
  const albumCount = albums.filter((a) => a.kind !== "track").length;
  const trackCount = albums.filter((a) => a.kind === "track").length;
  const parts = [];
  if (albumCount > 0) parts.push(`${albumCount} album${albumCount > 1 ? "s" : ""}`);
  if (trackCount > 0) parts.push(`${trackCount} song${trackCount > 1 ? "s" : ""}`);
  const countLabel = parts.join(", ") || "0 albums";

  return (
    <div
      className="modal-bg"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-h">
          <h3>
            {title} · {countLabel}
          </h3>
          <button className="x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-list">
          {sorted.map((al) => (
            <div className="alrow" key={al.id}>
              <div className="alrow-cover">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={al.cover}
                  alt=""
                  width={52}
                  height={52}
                  loading="lazy"
                  decoding="async"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
                <PlayButton item={al} className="alrow-play" />
              </div>
              <div className="meta">
                <div className="n">
                  {al.kind === "track" && <span className="kind-tag">♪</span>}
                  <a
                    className="al-link"
                    href={spotifyUrl(al.id, al.kind)}
                    target="_blank"
                    rel="noreferrer"
                    title={`Open “${al.name}” in Spotify`}
                  >
                    {al.name}
                  </a>
                </div>
                <div className="a">
                  {al.artists.map((x) => x.name).join(", ")}
                  {al.kind === "track" && al.albumName ? ` · ${al.albumName}` : ""}
                </div>
              </div>
              <QueueButton item={al} className="alrow-queue" />
              <div className="yr">{al.year ?? ""}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
