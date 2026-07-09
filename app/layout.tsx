import type { Metadata, Viewport } from "next";
import "./globals.css";
import SyncProvider from "@/components/SyncProvider";
import PlaybackProvider from "@/components/PlaybackProvider";

// Set NEXT_PUBLIC_SITE_URL to your deployed origin (e.g. https://calendar.example.com)
// so Open Graph / Twitter image URLs resolve to absolute links. Falls back to localhost.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000";

const title = "Spotify Library Calendar";
const catchline = "Every album, on the day you saved it.";
const description =
  "Browse your saved Spotify albums on a warm, editorial calendar — grouped by the day you added each one, filtered by year, artist and genre.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s · Library Calendar",
  },
  description,
  applicationName: title,
  keywords: [
    "Spotify",
    "album calendar",
    "music library",
    "saved albums",
    "listening history",
    "contact sheet",
  ],
  authors: [{ name: "Spotify Library Calendar" }],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: "Library Cal",
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    siteName: title,
    title: `${title} — ${catchline}`,
    description,
    url: "/",
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Spotify Library Calendar — a contact sheet of album covers laid out by the day you saved them.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${title} — ${catchline}`,
    description,
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#efe9dd" },
    { media: "(prefers-color-scheme: dark)", color: "#17140f" },
  ],
  colorScheme: "light dark",
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
        <SyncProvider>
          <PlaybackProvider>{children}</PlaybackProvider>
        </SyncProvider>
      </body>
    </html>
  );
}
