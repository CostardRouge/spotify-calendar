"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js, whose whole job is the offline page: when the phone
 * cannot reach the server, the installed app shows "cannot reach
 * Sillon" instead of a blank screen or Safari's error page. It caches
 * nothing else — see the file for why.
 *
 * Production only: in `next dev` a worker outlives every reload and keeps
 * serving whatever it installed first, which turns "is my change in?" into a
 * question about the worker instead of the code.
 */
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // A proxy that authenticates in front of the app may answer /sw.js with
      // its own login page: the app then simply works online-only.
    });
  }, []);
  return null;
}
