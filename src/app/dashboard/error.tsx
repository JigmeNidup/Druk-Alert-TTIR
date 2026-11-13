"use client";

import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-full place-items-center px-4">
      <section className="w-full max-w-md rounded-2xl border border-edge bg-surface p-8">
        <h1 className="text-xl font-semibold">The console could not load</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Zone data did not come back from Postgres. Confirm the database is running, then try again.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-muted">Reference {error.digest}</p>
        ) : null}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#07111f]"
          >
            Try again
          </button>
          <Link href="/" className="rounded-lg border border-edge px-4 py-2 text-sm">
            Sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
