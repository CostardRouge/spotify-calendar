import { notFound } from "next/navigation";
import type { ViewMode } from "@/lib/dates";
import CalendarApp from "@/components/CalendarApp";

const VIEWS: ViewMode[] = ["month", "week", "day", "year", "list", "stats"];

// Pre-render a static shell for each view so the correct view is server-rendered
// from the path — the app opens straight into it, with no flash of another view.
export function generateStaticParams() {
  return VIEWS.map((view) => ({ view }));
}

export default function ViewPage({ params }: { params: { view: string } }) {
  if (!(VIEWS as string[]).includes(params.view)) notFound();
  return <CalendarApp initialView={params.view as ViewMode} />;
}
