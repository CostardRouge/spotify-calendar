"use client";

import { useMemo } from "react";
import type { Album } from "@/lib/types";
import { groupByDay } from "@/lib/library";
import { MONTHS_SHORT, keyOf, addDays } from "@/lib/dates";

/** Year overview: 12 mini-month heatmaps shaded by albums added per day. */
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
  const byDay = useMemo(() => groupByDay(albums), [albums]);
  const max = useMemo(() => {
    let m = 0;
    for (const [k, list] of Object.entries(byDay)) {
      if (k.startsWith(String(year))) m = Math.max(m, list.length);
    }
    return m;
  }, [byDay, year]);

  const shade = (n: number) => {
    if (n === 0) return "var(--cell)";
    const t = max > 0 ? 0.25 + 0.75 * (n / max) : 0.5;
    return `color-mix(in srgb, var(--accent) ${Math.round(t * 100)}%, var(--cell))`;
  };

  return (
    <div className="year-grid">
      {Array.from({ length: 12 }, (_, month) => {
        const first = new Date(year, month, 1);
        const gridStart = addDays(first, -first.getDay());
        const cells = Array.from({ length: 42 }, (_, i) => {
          const d = addDays(gridStart, i);
          const key = keyOf(d);
          return {
            key,
            inMonth: d.getMonth() === month,
            count: (byDay[key] ?? []).length,
          };
        });
        const monthTotal = cells.reduce(
          (s, c) => s + (c.inMonth ? c.count : 0),
          0,
        );
        return (
          <div className="mini-month" key={month}>
            <button className="mini-head" onClick={() => onSelectMonth(month)}>
              {MONTHS_SHORT[month]}
              {monthTotal > 0 && <span className="mini-total">{monthTotal}</span>}
            </button>
            <div className="mini-grid">
              {cells.map((c, i) => (
                <div
                  key={c.key + i}
                  className={"mini-cell" + (c.count > 0 ? " has" : "")}
                  title={
                    c.inMonth && c.count > 0 ? `${c.key}: ${c.count}` : undefined
                  }
                  style={{
                    background: c.inMonth ? shade(c.count) : "transparent",
                    cursor: c.count > 0 ? "pointer" : "default",
                  }}
                  onClick={() => c.inMonth && c.count > 0 && onSelectDay(c.key)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
