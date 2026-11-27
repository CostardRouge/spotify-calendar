"use client";

import { useMemo, useState } from "react";
import type { Album } from "@/lib/types";
import { groupByDay } from "@/lib/library";
import { discLayout } from "@/lib/disc";
import { MONTHS_SHORT, formatDay } from "@/lib/dates";

const SIZE = 400;

/**
 * The year as a record (lib/disc.ts): a groove per month, January at the
 * label, December at the rim, a dot per day with saves. A dot opens its day;
 * the month list beside it opens a month, and is also the keyboard's way in —
 * the dots are many and small, the list is twelve buttons.
 */
export default function YearView({
  albums,
  year,
  onSelectDay,
  onSelectMonth,
}: {
  albums: Album[];
  year: number;
  onSelectDay: (dateKey: string) => void;
  onSelectMonth: (month: number) => void;
}) {
  const [hot, setHot] = useState<number | null>(null);

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [k, list] of Object.entries(groupByDay(albums))) out[k] = list.length;
    return out;
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
                (ring.month === hot ? " hot" : ring.month === recordMonth ? " record-month" : "")
              }
              cx={c}
              cy={c}
              r={ring.r}
            />
          ))}
          {disc.dots.map((d) => (
            <circle
              key={d.dateKey}
              className={"dot" + (hot != null && d.month !== hot ? " dim" : "")}
              cx={d.cx}
              cy={d.cy}
              r={d.r}
              onClick={() => onSelectDay(d.dateKey)}
              onMouseEnter={() => setHot(d.month)}
              onMouseLeave={() => setHot(null)}
            >
              <title>{`${formatDay(d.dateKey)} — ${d.count} saved`}</title>
            </circle>
          ))}
          <circle className="label" cx={c} cy={c} r={disc.label} />
          <text className="label-year" x={c} y={c + 2} textAnchor="middle" fontSize={26}>
            {year}
          </text>
          <text className="label-sub" x={c} y={c + 22} textAnchor="middle" fontSize={10}>
            {`${total} SAVED`}
          </text>
        </svg>
        <p className="disc-legend">January at the label → December at the rim · one dot per day</p>
      </div>

      <div className="disc-months">
        {perMonth.map((n, m) => (
          <button
            key={m}
            className={"disc-month" + (n === 0 ? " empty" : "") + (hot === m ? " hot" : "")}
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
