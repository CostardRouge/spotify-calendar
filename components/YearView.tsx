"use client";

import { useMemo, useState } from "react";
import type { Album } from "@/lib/types";
import { groupByDay } from "@/lib/library";
import { discLayout } from "@/lib/disc";
import { MONTHS, MONTHS_SHORT, formatDay } from "@/lib/dates";

const SIZE = 400;

/**
 * The year as a record (lib/disc.ts): a groove per month, January at the
 * label, December at the rim, a dot per day with saves. One month at a time
 * shows its days as covers on its groove — the month the calendar is on, or
 * the one under the pointer — and the rest stay quiet dots: the colour comes
 * from the music, not from the accent (the owner found the all-orange disc
 * flat). A dot opens its day; the month list beside it opens a month, and is
 * also the keyboard's way in — the dots are many and small.
 */
export default function YearView({
  albums,
  year,
  month,
  onSelectDay,
  onSelectMonth,
}: {
  albums: Album[];
  year: number;
  /** The calendar's month (0-based): its days show as covers. */
  month: number;
  onSelectDay: (dateKey: string) => void;
  onSelectMonth: (month: number) => void;
}) {
  const [hot, setHot] = useState<number | null>(null);

  const { counts, covers } = useMemo(() => {
    const counts: Record<string, number> = {};
    const covers: Record<string, string> = {};
    for (const [k, list] of Object.entries(groupByDay(albums))) {
      counts[k] = list.length;
      const first = [...list].sort((a, b) => +new Date(a.addedAt) - +new Date(b.addedAt))[0];
      if (first?.cover) covers[k] = first.cover;
    }
    return { counts, covers };
  }, [albums]);
  const disc = useMemo(() => discLayout(counts, year, SIZE), [counts, year]);

  const perMonth = useMemo(() => {
    const m = Array.from({ length: 12 }, () => 0);
    for (const d of disc.dots) m[d.month] += d.count;
    return m;
  }, [disc]);
  const total = perMonth.reduce((a, b) => a + b, 0);
  const peak = Math.max(...perMonth);
  const recordMonth = peak > 0 ? perMonth.indexOf(peak) : -1;
  const c = SIZE / 2;
  // The month in covers: the one under the pointer, else the calendar's own
  // when it holds saves, else the busiest.
  const shown = hot ?? (perMonth[month] > 0 ? month : recordMonth);
  const step = disc.rings.length > 1 ? disc.rings[1].r - disc.rings[0].r : 10;
  const coverR = (count: number) => Math.min(step * 0.55 + count * step * 0.06, step * 0.85);

  return (
    <div className="year-disc">
      <div className="disc-wrap">
        <svg
          className="disc"
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={`${year}: ${total} saved, drawn as a record — one groove per month, one dot per day`}
        >
          <circle className="platter" cx={c} cy={c} r={SIZE / 2} />
          {disc.rings.map((ring) => (
            <circle
              key={ring.month}
              className={
                "groove" +
                (ring.month === shown ? " shown" : "")
              }
              cx={c}
              cy={c}
              r={ring.r}
            />
          ))}
          <defs>
            {disc.dots
              .filter((d) => d.month === shown && covers[d.dateKey])
              .map((d) => (
                <pattern
                  key={d.dateKey}
                  id={`cv-${d.dateKey}`}
                  patternContentUnits="objectBoundingBox"
                  width="1"
                  height="1"
                >
                  <image href={covers[d.dateKey]} width="1" height="1" preserveAspectRatio="xMidYMid slice" />
                </pattern>
              ))}
          </defs>
          {disc.dots.map((d) => {
            const asCover = d.month === shown && !!covers[d.dateKey];
            return (
              <circle
                key={d.dateKey}
                className={"dot" + (asCover ? " cover" + (d.count > 1 ? " many" : "") : " dim")}
                cx={d.cx}
                cy={d.cy}
                r={asCover ? coverR(d.count) : d.r}
                // A style, not the fill attribute: app/globals.css fills every
                // dot, and a stylesheet rule outranks a presentation attribute.
                style={asCover ? { fill: `url(#cv-${d.dateKey})` } : undefined}
                onClick={() => onSelectDay(d.dateKey)}
                onMouseEnter={() => setHot(d.month)}
                onMouseLeave={() => setHot(null)}
              >
                <title>{`${formatDay(d.dateKey)} — ${d.count} saved`}</title>
              </circle>
            );
          })}
          <circle className="label" cx={c} cy={c} r={disc.label} />
          <text className="label-year" x={c} y={c + 2} textAnchor="middle" fontSize={26}>
            {year}
          </text>
          <text className="label-sub" x={c} y={c + 22} textAnchor="middle" fontSize={10}>
            {`${total} SAVED`}
          </text>
        </svg>
        <p className="disc-legend">
          January at the label → December at the rim
          {shown >= 0 ? ` · ${MONTHS[shown]} in covers` : " · one dot per day"}
        </p>
      </div>

      <div className="disc-months">
        {perMonth.map((n, m) => (
          <button
            key={m}
            className={"disc-month" + (n === 0 ? " empty" : "") + (shown === m ? " hot" : "")}
            onClick={() => onSelectMonth(m)}
            onMouseEnter={() => setHot(m)}
            onMouseLeave={() => setHot(null)}
            onFocus={() => setHot(m)}
            onBlur={() => setHot(null)}
          >
            <span className="m">{MONTHS_SHORT[m]}</span>
            <span className="bar" aria-hidden="true">
              <span style={{ width: peak ? `${(n / peak) * 100}%` : 0 }} />
            </span>
            <span className="n">{n}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
