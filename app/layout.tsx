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
    <html lang="en">
      <body>
        <SyncProvider>{children}</SyncProvider>
      </body>
    </html>
  );
}
