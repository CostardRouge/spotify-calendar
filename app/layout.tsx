import type { Metadata } from "next";
import "./globals.css";
import SyncProvider from "@/components/SyncProvider";

export const metadata: Metadata = {
  title: "Spotify Library Calendar",
  description:
    "Browse your saved Spotify albums on a calendar, grouped by the day you added them.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* Runs before the body paints: mirror the URL's collapsed-panel flag
            onto <html> so the sidebar is styled correctly on the very first
            frame, avoiding a flash of the expanded panel on refresh. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(new URLSearchParams(location.search).get('panel')==='0')document.documentElement.setAttribute('data-panel-collapsed','')}catch(e){}",
          }}
        />
        <SyncProvider>{children}</SyncProvider>
      </body>
    </html>
  );
}
