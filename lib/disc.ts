/**
 * The year as a record (the Year view): one groove per month, January at the
 * label, December at the rim, and one dot per day that holds saves, placed
 * around its groove by its day of the month — the first at twelve o'clock,
 * a full lap per month whatever its length. A dot grows with the day's count,
 * capped so neighbouring grooves never touch. Pure geometry in SVG units, so
 * the component only draws it and the layout is testable.
 */

export interface DiscRing {
  /** 0-based month. */
  month: number;
  r: number;
}

export interface DiscDot {
  dateKey: string;
  month: number;
  day: number;
  count: number;
  cx: number;
  cy: number;
  r: number;
}

export interface DiscLayout {
  size: number;
  /** Radius of the label in the middle, where the year is written. */
  label: number;
  rings: DiscRing[];
  dots: DiscDot[];
}

const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * `counts` maps YYYY-MM-DD keys to a number of saves; keys outside `year` are
 * ignored. `size` is the side of the square viewBox the disc is drawn in.
 */
export function discLayout(counts: Record<string, number>, year: number, size = 400): DiscLayout {
  const c = size / 2;
  const label = size * 0.13;
  const inner = size * 0.18;
  const outer = size * 0.47;
  const step = (outer - inner) / 11;
  const rings = Array.from({ length: 12 }, (_, month) => ({ month, r: round(inner + month * step) }));
  const maxDot = step * 0.48;
  const prefix = `${year}-`;

  const dots: DiscDot[] = [];
  for (const [dateKey, count] of Object.entries(counts)) {
    if (!dateKey.startsWith(prefix) || count <= 0) continue;
    const month = Number(dateKey.slice(5, 7)) - 1;
    const day = Number(dateKey.slice(8, 10));
    const angle = ((day - 1) / daysIn(year, month)) * Math.PI * 2 - Math.PI / 2;
    const r = rings[month].r;
    dots.push({
      dateKey,
      month,
      day,
      count,
      cx: round(c + r * Math.cos(angle)),
      cy: round(c + r * Math.sin(angle)),
      r: round(Math.min(size * 0.006 + count * size * 0.0028, maxDot)),
    });
  }
  dots.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  return { size, label: round(label), rings, dots };
}
