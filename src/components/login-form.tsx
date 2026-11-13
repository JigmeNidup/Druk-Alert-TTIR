"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(data?.error || "Invalid credentials.");
        setPending(false);
        return;
      }
      setPassword("");
      setPending(false);
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Sign-in is unavailable right now.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-hazard/40 bg-hazard/10 px-3 py-2 text-sm text-hazard"
        >
          {error}
        </p>
      ) : null}

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">
          Username
        </span>
        <input
          name="username"
          autoComplete="username"
          required
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Username"
          className="w-full rounded-lg border border-edge bg-[#0b1324] px-3 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">
          Password
        </span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          className="w-full rounded-lg border border-edge bg-[#0b1324] px-3 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-[#07111f] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
