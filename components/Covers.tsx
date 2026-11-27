"use client";

import type { Album } from "@/lib/types";

// The fan: each cover a little further right and a little more turned, like
// records pulled half out of a crate. Three at most — beyond that a 50px cell
// shows a pile, not covers; the day's count says the rest. The offsets are
// fractions of the cover's own width (CSS custom properties read by
// app/globals.css), so the fan keeps its shape at the phone's smaller size.
const FAN = [
  { x: "0%", r: "-7deg" },
  { x: "38%", r: "3deg" },
  { x: "76%", r: "11deg" },
];

/** Fanned stack of album covers used inside calendar cells. */
export default function Covers({ albums }: { albums: Album[] }) {
  return (
    <div className="covers">
      {albums.slice(0, FAN.length).map((al, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={al.id + i}
          src={al.cover}
          alt=""
          title={al.name}
          loading="lazy"
          decoding="async"
          onError={(e) => (e.currentTarget.style.display = "none")}
          style={{ zIndex: i, ["--fan-x" as string]: FAN[i].x, ["--fan-r" as string]: FAN[i].r }}
        />
      ))}
    </div>
  );
}
