"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSync } from "@/components/SyncProvider";
import { usePrefs } from "@/components/usePrefs";
import { useDismiss } from "@/components/useDismiss";
import Icon from "@/components/Icons";
import { phaseLabel } from "@/lib/sync";
import { THEMES, type Theme } from "@/lib/prefs";

const REPO = "https://github.com/CostardRouge/sillon";

// One /api/me read per page, shared by both account buttons (side rail and
// phone header). The name comes from a cookie set at login, so this costs no
// Spotify request; older sessions get "" and a generic label.
let namePromise: Promise<string> | null = null;
function loadName(): Promise<string> {
  namePromise ??= fetch("/api/me")
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (typeof j?.name === "string" ? j.name : ""))
    .catch(() => "");
  return namePromise;
}

const THEME_LABEL: Record<Theme, string> = { auto: "Auto", night: "Night", day: "Day" };
const THEME_ICON = { auto: "auto", night: "night", day: "day-theme" } as const;
const DOT: Record<string, string> = {
  running: "var(--accent)",
  paused: "var(--amber)",
  error: "var(--danger)",
  done: "var(--ok)",
};

/**
 * Who is signed in, the library and its sync, the theme, the version, the
 * code, and the way out — one place instead of a top bar that mixed them. The
 * side rail shows it as a button at its foot that opens upward; the phone
 * header as an avatar that opens a sheet from the bottom (app/globals.css).
 */
export default function AccountMenu({
  version,
  variant,
}: {
  version: string;
  variant: "rail" | "avatar";
}) {
  const { job, items, isRunning, start, refresh, pause } = useSync();
  const { theme, setTheme } = usePrefs();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  useEffect(() => {
    let live = true;
    void loadName().then((n) => live && setName(n));
    return () => {
      live = false;
    };
  }, []);

  const display = name || "Your account";
  const initial = (name.trim()[0] ?? "♪").toUpperCase();
  const albums = items.filter((i) => i.kind !== "track").length;
  const songs = items.length - albums;
  const status = phaseLabel(job);
  const dot = DOT[job.status] ?? "var(--muted)";

  const syncAction = isRunning
    ? { label: "Pause sync", run: pause }
    : job.status === "done"
      ? { label: "Check for new saves", run: refresh }
      : job.status === "paused"
        ? { label: "Resume sync", run: start }
        : { label: "Start sync", run: start };

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className={"account account-" + variant} ref={ref}>
      <button
        className="account-btn"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account: ${display}. ${status}, ${items.length} saves`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="avatar" aria-hidden="true">
          {initial}
          <span className="avatar-dot" style={{ background: dot }} />
        </span>
        {variant === "rail" && (
          <>
            <span className="account-text">
              <span className="account-name">{display}</span>
              <span className="account-sub">
                {status} · {items.length} saves
              </span>
            </span>
            <span className="account-chev">
              <Icon name="chevron" />
            </span>
          </>
        )}
      </button>

      {open && (
        <>
          <button className="account-scrim" aria-label="Close" onClick={close} />
          <div className="account-menu" role="menu" aria-label="Account">
            <span className="sheet-grip" aria-hidden="true" />
            <div className="am-head">
              <span className="avatar big" aria-hidden="true">
                {initial}
              </span>
              <span className="am-who">
                <span className="am-name">{display}</span>
                <span className="am-sub">Signed in with Spotify</span>
              </span>
            </div>

            <div className="am-library">
              <div className="am-count">
                <b>{items.length.toLocaleString()}</b>
                <span>
                  saves · {albums.toLocaleString()} albums, {songs.toLocaleString()} songs
                </span>
              </div>
              <div className="am-status">
                <span className="sync-dot" style={{ background: dot }} />
                {status}
              </div>
              <div className="am-actions">
                <button className="btn primary" onClick={syncAction.run}>
                  {syncAction.label}
                </button>
                <Link className="btn" href="/sync" onClick={close}>
                  Sync details
                </Link>
              </div>
            </div>

            <div className="am-theme">
              <span className="am-label" id={`theme-${variant}`}>
                Theme
              </span>
              <div className="seg" role="radiogroup" aria-labelledby={`theme-${variant}`}>
                {THEMES.map((t) => (
                  <button
                    key={t}
                    role="radio"
                    aria-checked={theme === t}
                    className={theme === t ? "on" : ""}
                    onClick={() => setTheme(t)}
                  >
                    <Icon name={THEME_ICON[t]} />
                    {THEME_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>

            <div className="am-sep" />
            <a className="am-item" role="menuitem" href={REPO} target="_blank" rel="noreferrer">
              <Icon name="github" />
              Sillon on GitHub
              <span className="am-aside" aria-hidden="true">
                ↗
              </span>
            </a>
            <a className="am-item" role="menuitem" href={`${REPO}/releases`} target="_blank" rel="noreferrer">
              <Icon name="news" />
              What&apos;s new
              <span className="am-aside">v{version}</span>
            </a>
            <div className="am-sep" />
            <button className="am-item danger" role="menuitem" onClick={logout}>
              <Icon name="logout" />
              Log out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
