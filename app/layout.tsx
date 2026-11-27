import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import "./globals.css";
import SyncProvider from "@/components/SyncProvider";
import PlaybackProvider from "@/components/PlaybackProvider";
import ServiceWorker from "@/components/ServiceWorker";
import { requestOrigin } from "@/lib/origin";
import { THEME_BOOT_SCRIPT } from "@/lib/prefs";

// The app is called Sillon — the groove of a record, the trace your listening
// leaves in time. "Spotify" stays out of the name: Spotify's developer terms
// keep their mark out of third-party app names. The repository, the image and
// the domain are sillon too; only the identifiers nobody reads — the IndexedDB
// name, the HMAC labels, the volume, the temp folders — keep
// "spotify-calendar", because renaming them orphans saved libraries or signs
// everyone out for nothing (docs/memory/deployment.md).
const title = "Sillon";
const catchline = "Your records, day by day.";
const description =
  "Sillon lays your saved Spotify albums and liked songs on a calendar, by the day you saved each one — the year as a record, a random dig through your past, and what you were saving a year ago.";

// Self-hosted (app/fonts, OFL), so nothing is fetched from a font CDN and the
// content security policy's `font-src 'self'` holds. Unbounded, round and
// wide, sets the dates and numbers; Inter everything else.
const display = localFont({
  src: "./fonts/unbounded-latin-wght.woff2",
  weight: "200 900",
  variable: "--font-display",
  display: "swap",
});
const body = localFont({
  src: "./fonts/inter-latin-wght.woff2",
  weight: "100 900",
  variable: "--font-body",
  display: "swap",
});

/**
 * Built per request for one reason: link previews. og:image must be absolute,
 * and the one image CI builds cannot know the address it will be reached at
 * (lib/origin.ts), so metadataBase comes from the request. Reading the headers
 * makes the views render per request instead of from a build-time shell; they
 * still render the view named by the path, so the app opens straight into it
 * as before. NEXT_PUBLIC_SITE_URL, when set at build time, still wins.
 */
export async function generateMetadata(): Promise<Metadata> {
  const fixed = process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  const metadataBase = fixed ? new URL(fixed) : requestOrigin((name) => h.get(name));
  return { ...(metadataBase ? { metadataBase } : {}), ...shared };
}

const shared: Metadata = {
  title: {
    default: title,
    template: "%s · Sillon",
  },
  description,
  applicationName: title,
  keywords: [
    "Spotify",
    "album calendar",
    "music library",
    "saved albums",
    "listening history",
    "vinyl",
  ],
  authors: [{ name: "Sillon" }],
  manifest: "/manifest.webmanifest",
  // The icon set (COMMON-PROJECT-SPEC, C11): public/icons, drawn by
  // scripts/gen-icons.mjs. iOS reads the touch icon alone; the manifest
  // carries the 192/512 and maskable pairs for Android.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/icons/favicon-16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  // "default", not "black-translucent": the latter draws white status-bar
  // text over the page, unreadable on the light (day) theme.
  appleWebApp: {
    capable: true,
    title: "Sillon",
    statusBarStyle: "default",
  },
  // A private instance: someone's library behind Spotify's sign-in (and
  // Sésame, when set). public/robots.txt says the same to crawlers that read
  // it first; the public page is the showcase on GitHub Pages.
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  // Previews still matter when a link is pasted into a chat: the card is a
  // drawing (no cover, no title, no account of anyone's), outside the gate.
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
        alt: "Sillon — the year drawn as a record, one groove per month, one dot per day you saved music.",
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
    { media: "(prefers-color-scheme: light)", color: "#f6f1ea" },
    { media: "(prefers-color-scheme: dark)", color: "#15110e" },
  ],
  colorScheme: "light dark",
  // Lets an installed app reach the rounded corners and the notch, which is
  // what makes env(safe-area-inset-*) real; app/globals.css pads the top bar,
  // the sides and the tab bar with them.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <body>
        {/* Runs before the body paints: a theme this device chose in the
            account menu (lib/prefs.ts) is on <html> before the first frame,
            so a forced day or night never flashes the device's own theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <SyncProvider>
          <PlaybackProvider>{children}</PlaybackProvider>
        </SyncProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
