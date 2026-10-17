import { notFound } from "next/navigation";
import type { ViewMode } from "@/lib/dates";
import CalendarApp from "@/components/CalendarApp";
import { APP_VERSION } from "@/lib/version";

const VIEWS: ViewMode[] = ["month", "week", "day", "year", "list", "stats"];

// Pre-render a static shell for each view so the correct view is server-rendered
// from the path — the app opens straight into it, with no flash of another view.
export function generateStaticParams() {
  return VIEWS.map((view) => ({ view }));
}

// `params` is a Promise as of Next 15 — dynamic route params resolve lazily.
export default async function ViewPage({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  if (!(VIEWS as string[]).includes(view)) notFound();
  // The version is read here, on the server, and passed down: see lib/version.ts.
  return <CalendarApp initialView={view as ViewMode} version={APP_VERSION} />;
}
