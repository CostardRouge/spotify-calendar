import type { ViewMode } from "@/lib/dates";

/**
 * The interface's stroke icons, drawn inline so they take the text colour
 * (`currentColor`) in both themes and cost no request. Decorative: every
 * button that shows one carries its own label.
 */
type Name =
  | ViewMode
  | "filters"
  | "options"
  | "prev"
  | "next"
  | "needle"
  | "sort"
  | "chevron"
  | "auto"
  | "night"
  | "day-theme"
  | "github"
  | "logout"
  | "news"
  | "search";

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
  // The wall's order: the first day first, or the last.
  sort: <path d="M7 4v16M3 16l4 4 4-4M14 6h7M14 12h5M14 18h3" />,
  chevron: <path d="M6 9l6 6 6-6" />,
  // Theme choices: half a disc (the device decides), a moon, a sun.
  auto: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
    </>
  ),
  night: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  "day-theme": (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" />
    </>
  ),
  github: (
    <path d="M9 19c-4 1.5-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.6 11.6 0 0 0-6 0C6.8 2.8 5.8 3.1 5.8 3.1a4.3 4.3 0 0 0-.1 3.2A4.6 4.6 0 0 0 4.4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />
  ),
  logout: <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" />,
  news: <path d="M4 6h16M4 12h10M4 18h7" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
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
