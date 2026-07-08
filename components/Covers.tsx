"use client";

import type { Album } from "@/lib/types";

/** Overlapping stack of album covers used inside calendar cells. */
export default function Covers({
  albums,
  max = 6,
  step = 11,
}: {
  albums: Album[];
  max?: number;
  step?: number;
}) {
  return (
    <div className="covers">
      {albums.slice(0, max).map((al, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={al.id + i}
          src={al.cover}
          alt=""
          title={al.name}
          loading="lazy"
          onError={(e) => (e.currentTarget.style.display = "none")}
          style={{ left: i * step, top: i * (step / 2), zIndex: i }}
        />
      ))}
    </div>
  );
}
