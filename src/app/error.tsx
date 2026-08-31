"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ErrorBoundary({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="fatal-screen">
      <AlertTriangle aria-hidden="true" size={30} />
      <h1>The workbench hit an unexpected problem</h1>
      <p>
        Your saved networks and scenarios are still in SQLite. Retry the request
        to return to the planner.
      </p>
      <button className="primary-action compact" onClick={retry}>
        Try again
        <RefreshCw aria-hidden="true" size={16} />
      </button>
    </main>
  );
}
