import { redirect } from "next/navigation";

// The view now lives in the path (/month, /week, /day, /year, /list, /stats).
// Send the bare root to the default month view.
export default function Home() {
  redirect("/month");
}
