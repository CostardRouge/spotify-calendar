import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import SyncProvider from "@/components/SyncProvider";
import PlaybackProvider from "@/components/PlaybackProvider";
import ServiceWorker from "@/components/ServiceWorker";
import { requestOrigin } from "@/lib/origin";

const title = "spotify-calendar";
const catchline = "Every album, on the day you saved it.";
const description =
  "Browse your saved Spotify albums on a warm, editorial calendar — grouped by the day you added each one, filtered by year, artist and genre.";

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
    template: "%s · spotify-calendar",
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
  authors: [{ name: "spotify-calendar" }],
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
  // text over the page, unreadable on the light paper theme.
  appleWebApp: {
    capable: true,
    title: "spotify-cal",
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
        alt: "spotify-calendar — a contact sheet of album covers laid out by the day you saved them.",
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
        <ServiceWorker />
      </body>
    </html>
  );
}
