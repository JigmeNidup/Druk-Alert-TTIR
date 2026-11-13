"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { alarmReady, playAlarm, unlockAlarm } from "@/lib/alarm";
import {
  ALERT_STARTED,
  RESOLVED_ACKNOWLEDGED,
  RESOLVED_UNACKNOWLEDGED,
  isResolvedAction,
} from "@/lib/events";
import { CHART_VIEW, chartSegments } from "@/lib/chart";
import {
  formatDistance,
  formatHumidity,
  formatMotion,
  formatStamp,
} from "@/lib/format";
import type { EventView, StatusPayload, ZoneView } from "@/lib/types";
import { AWAITING_TELEMETRY } from "@/lib/zones";

const LIVE_WINDOW_MS = 12_000;
const ALARM_REPEAT_MS = 12_000;

export function Dashboard({
  initial,
  username,
  isAdmin,
  botLink,
}: {
  initial: StatusPayload;
  username: string;
  isAdmin: boolean;
  botLink: string;
}) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [expired, setExpired] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [ackingId, setAckingId] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [now, setNow] = useState(0);
  const heard = useRef(new Set<string>());

  const unacknowledged = data.events.filter(
    (event) => event.action === ALERT_STARTED && !event.acknowledgedAt,
  );
  const unackedKey = unacknowledged.map((event) => event.id).join(",");

  useEffect(() => {
    const enable = () => {
      unlockAlarm();
      if (alarmReady()) setSoundOn(true);
    };
    window.addEventListener("pointerdown", enable);
    window.addEventListener("keydown", enable);
    return () => {
      window.removeEventListener("pointerdown", enable);
      window.removeEventListener("keydown", enable);
    };
  }, []);

  useEffect(() => {
    if (!unackedKey || !soundOn) return;
    const ids = unackedKey.split(",");
    const fresh = ids.some((id) => !heard.current.has(id));
    ids.forEach((id) => heard.current.add(id));
    if (fresh) playAlarm();
  }, [unackedKey, soundOn]);

  useEffect(() => {
    if (!unackedKey || !soundOn) return;
    const repeat = setInterval(() => {
      playAlarm();
    }, ALARM_REPEAT_MS);
    return () => clearInterval(repeat);
  }, [unackedKey, soundOn]);

  useEffect(() => {
    let stop = false;

    async function tick() {
      try {
        const response = await fetch("/api/status", { cache: "no-store" });
        if (response.status === 401) {
          if (!stop) setExpired(true);
          return;
        }
        if (!response.ok) return;
        const next = (await response.json()) as StatusPayload;
        if (!stop) setData(next);
      } catch {
        // Keep the last good snapshot if a poll fails.
      }
    }

    const poll = setInterval(tick, 2000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      stop = true;
      clearInterval(poll);
      clearInterval(clock);
    };
  }, []);

  async function acknowledge(id: string) {
    setAckingId(id);
    try {
      const response = await fetch(`/api/alerts/${id}/acknowledge`, { method: "POST" });
      if (response.status === 401) {
        setExpired(true);
        return;
      }
      if (!response.ok) return;
      const saved = (await response.json()) as {
        acknowledgedAt: string | null;
        acknowledgedBy: string | null;
      };
      setData((current) => ({
        ...current,
        events: current.events.map((event) =>
          event.id === id ? { ...event, ...saved } : event,
        ),
      }));
    } finally {
      setAckingId(null);
    }
  }

  function enableSound() {
    unlockAlarm();
    if (alarmReady()) setSoundOn(true);
  }

  async function signOut() {
    setSigningOut(true);
    await fetch("/api/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const active = data.zones.filter((zone) => zone.alert);
  const faults = data.zones.filter((zone) => zone.sensorFault && !zone.alert);
  const liveZones = data.zones.filter((zone) => zone.status !== AWAITING_TELEMETRY);
  const latest = liveZones.reduce<string | null>((newest, zone) => {
    if (!newest || zone.updatedAt > newest) return zone.updatedAt;
    return newest;
  }, null);
  const age = latest && now > 0 ? now - new Date(latest).getTime() : null;
  const link =
    active.length > 0
      ? "hazard"
      : faults.length > 0
        ? "fault"
        : liveZones.length === 0
          ? "standby"
          : age == null || age < LIVE_WINDOW_MS
            ? "clear"
            : "stale";
  const pill =
    active.length > 0
      ? "Hazard"
      : faults.length > 0
        ? "Sensor fault"
        : liveZones.length === 0
          ? "Standby"
          : "Clear";

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-5 border-b border-edge pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-sm font-semibold text-[#07111f]">
            DA
          </span>
          <div>
            <p className="text-[11px] font-medium tracking-[0.18em] text-muted uppercase">
              TTI Rangjung
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">DrukAlert</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <StatusPill
            tone={
              link === "hazard" ? "hazard" : link === "clear" ? "clear" : "standby"
            }
          >
            {pill}
          </StatusPill>
          <p className="font-mono text-xs text-muted">
            {latest ? `${link === "stale" ? "Stale" : "Live"} · ${formatStamp(latest)}` : "No packet yet"}
          </p>
          <a
            href={botLink}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-edge bg-surface px-3 py-2 text-sm font-medium transition hover:border-accent"
          >
            Telegram bot
          </a>
          <a
            href="/api/logs/export"
            className="rounded-lg border border-edge bg-surface px-3 py-2 text-sm font-medium transition hover:border-accent"
          >
            Download CSV
          </a>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="rounded-lg border border-edge bg-surface px-3 py-2 text-sm font-medium transition hover:border-accent disabled:opacity-70"
          >
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </header>

      <p className="mt-4 text-sm text-muted">
        Signed in as <span className="text-foreground">{username}</span>
        {isAdmin ? <span className="text-muted"> · Admin</span> : null}
      </p>

      {expired ? (
        <p role="alert" className="mt-4 rounded-xl border border-standby/40 bg-standby/10 px-4 py-3 text-sm text-standby">
          Session expired.{" "}
          <Link href="/" className="underline">
            Sign in again
          </Link>
          .
        </p>
      ) : null}

      {unacknowledged.length > 0 && !soundOn ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-standby/40 bg-standby/10 px-4 py-3">
          <p className="text-sm text-standby">The alarm is waiting for a click before it can play.</p>
          <button
            type="button"
            onClick={enableSound}
            className="rounded-lg bg-standby px-3 py-2 text-sm font-semibold text-[#07111f]"
          >
            Enable alarm sound
          </button>
        </div>
      ) : null}

      {active.length > 0 ? (
        <div
          role="status"
          aria-live="polite"
          className="mt-5 rounded-xl border border-hazard/40 bg-hazard/10 px-4 py-3"
        >
          <p className="text-sm font-semibold text-hazard">Active hazard</p>
          <ul className="mt-3 space-y-2">
            {active.map((zone) => {
              const event = data.events.find(
                (item) => item.zone === zone.zone && item.action === ALERT_STARTED,
              );
              return (
                <li key={zone.zone} className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm text-foreground">{zone.name}</span>
                  {event && !event.acknowledgedAt ? (
                    <AckButton
                      pending={ackingId === event.id}
                      onClick={() => acknowledge(event.id)}
                    />
                  ) : event?.acknowledgedBy ? (
                    <SeenNote event={event} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <section className="mt-5 grid gap-4 lg:grid-cols-3">
        {data.zones.map((zone) => (
          <ZoneCard key={zone.zone} zone={zone} />
        ))}
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-edge bg-surface">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-edge px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">Hazard log</h2>
            <p className="mt-1 text-sm text-muted">
              A row is written when an alert turns on, and again when that zone returns to normal.
              The board refreshes every 2 seconds.
            </p>
          </div>
        </div>
        {data.events.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="font-medium">No hazards recorded</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">
              Events appear here the moment a zone goes from clear to alert.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-surface-2 text-xs tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Zone</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Distance</th>
                  <th className="px-4 py-3 font-medium">Humidity</th>
                  <th className="px-4 py-3 font-medium">Motion</th>
                  <th className="px-4 py-3 font-medium">Seen</th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((event) => (
                  <tr key={event.id} className="border-t border-edge">
                    <td className="px-4 py-3 font-mono text-xs text-muted">
                      {formatStamp(event.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-medium">{event.zoneName}</td>
                    <td
                      className={`px-4 py-3 ${isResolvedAction(event.action) ? "text-clear" : "text-hazard"}`}
                    >
                      {event.status}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{formatDistance(event.distanceCm)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatHumidity(event.humidityPct)}</td>
                    <td className="px-4 py-3">{formatMotion(event.motion)}</td>
                    <td className="px-4 py-3">
                      <SeenCell
                        event={event}
                        pending={ackingId === event.id}
                        onAcknowledge={() => acknowledge(event.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data.hasMoreEvents ? (
          <p className="border-t border-edge px-5 py-3 text-xs text-muted">
            Showing the latest 25 events. Download the CSV for the full log.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function ZoneCard({ zone }: { zone: ZoneView }) {
  const tone = zone.alert
    ? "hazard"
    : zone.sensorFault
      ? "fault"
      : zone.status === AWAITING_TELEMETRY
        ? "standby"
        : "clear";

  return (
    <article
      className={`rounded-2xl border p-5 ${
        tone === "hazard"
          ? "border-hazard/70 bg-[#2a1419] shadow-[0_0_0_1px_rgba(248,113,113,0.18)]"
          : tone === "fault"
            ? "border-standby/60 bg-[#241c10]"
            : "border-edge bg-surface"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.16em] text-muted uppercase">
            {zone.hazard}
          </p>
          <h2 className="mt-1 text-lg font-semibold leading-snug">{zone.name}</h2>
        </div>
        <ZoneMark kind={zone.kind} alert={zone.alert} />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${
            tone === "hazard"
              ? "animate-pulse bg-hazard"
              : tone === "clear"
                ? "bg-clear"
                : "bg-standby"
          }`}
        />
        <p
          className={`text-sm font-medium ${
            tone === "hazard" ? "text-hazard" : tone === "fault" ? "text-standby" : "text-foreground"
          }`}
        >
          {zone.status}
        </p>
      </div>
      <p className="mt-2 min-h-10 text-sm leading-5 text-muted">{zone.summary}</p>

      <dl className="mt-4 grid grid-cols-2 gap-3">
        {zone.kind === "gate" ? (
          <>
            <Metric label="Approach" value={formatDistance(zone.distanceCm)} alert={zone.alert} />
            <Metric
              label="Motion"
              value={formatMotion(zone.motion)}
              alert={zone.alert && zone.motion === true}
            />
          </>
        ) : (
          <>
            <Metric
              label={zone.kind === "water" ? "Water proximity" : "Slope distance"}
              value={formatDistance(zone.distanceCm)}
              alert={zone.alert}
            />
            <Metric label="Humidity" value={formatHumidity(zone.humidityPct)} alert={zone.alert} />
          </>
        )}
      </dl>
      <ZoneChart zone={zone} />
    </article>
  );
}

function SeenCell({
  event,
  pending,
  onAcknowledge,
}: {
  event: EventView;
  pending: boolean;
  onAcknowledge: () => void;
}) {
  if (event.action === RESOLVED_ACKNOWLEDGED) {
    return (
      <span className="text-xs text-muted">
        Acknowledged first{event.acknowledgedBy ? ` · ${event.acknowledgedBy}` : ""}
      </span>
    );
  }
  if (event.action === RESOLVED_UNACKNOWLEDGED) {
    return <span className="text-xs text-standby">Not acknowledged</span>;
  }
  if (event.acknowledgedAt && event.acknowledgedBy) {
    return <SeenNote event={event} />;
  }
  return <AckButton pending={pending} onClick={onAcknowledge} />;
}

function AckButton({ pending, onClick }: { pending: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="rounded-lg bg-hazard px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-70"
    >
      {pending ? "Saving..." : "Acknowledge"}
    </button>
  );
}

function SeenNote({ event }: { event: EventView }) {
  return (
    <span className="text-xs text-muted">
      Seen by {event.acknowledgedBy}
      {event.acknowledgedAt ? ` · ${formatStamp(event.acknowledgedAt)}` : ""}
    </span>
  );
}

function ZoneChart({ zone }: { zone: ZoneView }) {
  const distance = chartSegments(zone.readings, "distanceCm");
  const humidity = zone.kind === "gate" ? [] : chartSegments(zone.readings, "humidityPct");
  const empty = distance.length === 0 && humidity.length === 0;

  return (
    <div className="mt-4">
      {empty ? (
        <p className="text-xs text-muted">History appears after the first minute of readings.</p>
      ) : (
        <svg
          viewBox={`0 0 ${CHART_VIEW.width} ${CHART_VIEW.height}`}
          className="h-16 w-full"
          role="img"
          aria-label={`${zone.name} readings for the last hour`}
        >
          {distance.map((points) => (
            <polyline
              key={`d-${points}`}
              points={points}
              fill="none"
              stroke="#7cb3ff"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {humidity.map((points) => (
            <polyline
              key={`h-${points}`}
              points={points}
              fill="none"
              stroke="#fbbf24"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
        </svg>
      )}
      <p className="mt-1 text-[11px] tracking-wide text-muted uppercase">
        Last hour
        <span className="ml-2 text-accent">Distance</span>
        {zone.kind === "gate" ? null : <span className="ml-2 text-standby">Humidity</span>}
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  alert,
}: {
  label: string;
  value: string;
  alert: boolean;
}) {
  return (
    <div className="rounded-xl bg-background/50 px-3 py-2">
      <dt className="text-[11px] tracking-wide text-muted uppercase">{label}</dt>
      <dd className={`mt-1 font-mono text-sm tabular-nums ${alert ? "text-hazard" : "text-foreground"}`}>
        {value}
      </dd>
    </div>
  );
}

function StatusPill({
  tone,
  children,
}: {
  tone: "hazard" | "clear" | "standby";
  children: string;
}) {
  const styles = {
    hazard: "border-hazard/50 bg-hazard/15 text-hazard",
    clear: "border-clear/40 bg-clear/10 text-clear",
    standby: "border-standby/40 bg-standby/10 text-standby",
  }[tone];

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${styles}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${tone === "hazard" ? "animate-pulse bg-current" : "bg-current"}`} />
      {children}
    </span>
  );
}

function ZoneMark({ kind, alert }: { kind: ZoneView["kind"]; alert: boolean }) {
  const color = alert ? "text-hazard" : "text-accent";
  return (
    <span className={`grid h-10 w-10 place-items-center rounded-xl bg-background/60 ${color}`}>
      {kind === "water" ? <WaterIcon /> : kind === "slope" ? <SlopeIcon /> : <GateIcon />}
    </span>
  );
}

function GateIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 17V5.5A1.5 1.5 0 0 1 4.5 4h11A1.5 1.5 0 0 1 17 5.5V17" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 17h14M10 4v13M7 9h.01M13 9h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function SlopeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M2 16 8.5 6l3 4.5L14 8l4 8H2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function WaterIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M2 13c1.4-1.2 2.6-1.2 4 0s2.6 1.2 4 0 2.6-1.2 4 0 2.6 1.2 4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M2 8.5c1.4-1.2 2.6-1.2 4 0s2.6 1.2 4 0 2.6-1.2 4 0 2.6 1.2 4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
