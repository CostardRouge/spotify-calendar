import type { ViewMode } from "@/lib/dates";

/**
 * The interface's stroke icons, drawn inline so they take the text colour
 * (`currentColor`) in both themes and cost no request. Decorative: every
 * button that shows one carries its own label.
 */
type Name = ViewMode | "filters" | "options" | "prev" | "next" | "needle";

const PATHS: Record<Name, React.ReactNode> = {
  month: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="3" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
  week: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="3" />
      <path d="M4 10h16M9 3v4M15 3v4M8 15h8" />
    </>
  ),
  day: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="3" />
      <path d="M4 10h16M9 3v4M15 3v4" />
      <circle cx="12" cy="15" r="1.6" fill="currentColor" />
    </>
  ),
  year: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5.5" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    </>
  ),
  list: <path d="M5 6h14M5 12h14M5 18h9" />,
  stats: <path d="M5 20V11M12 20V4M19 20v-6" />,
  filters: <path d="M4 6h16M7 12h10M10 18h4" />,
  options: (
    <>
      <circle cx="5" cy="12" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" />
    </>
  ),
  prev: <path d="M15 5l-7 7 7 7" />,
  next: <path d="M9 5l7 7-7 7" />,
  // The tonearm over a record: "drop the needle" on a random day.
  needle: (
    <>
      <circle cx="10" cy="14" r="7" />
      <circle cx="10" cy="14" r="1.6" fill="currentColor" />
      <path d="M20 3l-3 9-4 3" />
    </>
  ),
};

export default function Icon({ name }: { name: Name }) {
  return (
    <svg
      className="ico"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
