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
        <span className="mark" aria-hidden="true" />
        <h1>sillon</h1>
        <p className="catch">Your records, day by day.</p>
        <p>
          Your saved Spotify albums and liked songs, laid out by the day you saved
          them: the year as a record, a random dig through your past, and what you
          were saving a year ago. Sign-in runs on the server — your tokens stay in
          httpOnly cookies.
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
