import { notFound } from "next/navigation";
import type { ViewMode } from "@/lib/dates";
import CalendarApp from "@/components/CalendarApp";

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
  return <CalendarApp initialView={view as ViewMode} />;
}
