"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const messages: Record<string, string> = {
  state_mismatch: "Security check failed. Please try connecting again.",
  exchange_failed: "Login failed. Check your Client ID / Secret and Redirect URI.",
  access_denied: "Authorization was cancelled.",
};

function LoginInner() {
  const params = useSearchParams();
  const error = params.get("error");
  const msg = error ? messages[error] ?? "Authorization failed." : null;

  return (
    <div className="center-screen">
      <div className="card">
        <h1>
          <span style={{ color: "var(--accent)" }}>●</span> Library Calendar
        </h1>
        <p>
          Browse your saved Spotify albums on a calendar, arranged by the day you
          added them. Login is handled securely on the server — your tokens stay
          in httpOnly cookies.
        </p>
        {msg && <p className="err">{msg}</p>}
        <a className="btn primary" href="/api/auth/login">
          Connect Spotify
        </a>
        <p style={{ marginTop: 16, fontSize: 12 }}>
          First run? Configure your credentials in <code>.env</code> — see{" "}
          <code>README.md</code>.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
