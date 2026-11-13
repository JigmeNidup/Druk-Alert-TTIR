import { prisma } from "./db";
import type { StatusPayload } from "./types";
import { AWAITING_TELEMETRY, zoneById, ZONES } from "./zones";

const HISTORY_WINDOW_MS = 70 * 60 * 1000;

export async function getStatus(): Promise<StatusPayload> {
  const since = new Date(Date.now() - HISTORY_WINDOW_MS);
  const [rows, events, readings] = await Promise.all([
    prisma.zoneStatus.findMany(),
    prisma.hazardEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 26,
    }),
    prisma.zoneReading.findMany({
      where: { recordedAt: { gte: since } },
      orderBy: { recordedAt: "asc" },
    }),
  ]);

  const byId = new Map(rows.map((row) => [row.zone, row]));

  return {
    zones: ZONES.map((zone) => {
      const row = byId.get(zone.id);
      return {
        zone: zone.id,
        name: row?.name ?? zone.name,
        hazard: zone.hazard,
        kind: zone.kind,
        summary: zone.summary,
        status: row?.status ?? AWAITING_TELEMETRY,
        distanceCm: row?.distanceCm ?? null,
        humidityPct: row?.humidityPct ?? null,
        motion: row?.motion ?? null,
        alert: row?.alert ?? false,
        sensorFault: row?.sensorFault ?? false,
        updatedAt: (row?.updatedAt ?? new Date(0)).toISOString(),
        readings: readings
          .filter((reading) => reading.zone === zone.id)
          .map((reading) => ({
            recordedAt: reading.recordedAt.toISOString(),
            distanceCm: reading.distanceCm,
            humidityPct: reading.humidityPct,
          })),
      };
    }),
    events: events.slice(0, 25).map((event) => ({
      id: event.id,
      zone: event.zone,
      zoneName: zoneById(event.zone)?.name ?? event.zone,
      status: event.status,
      distanceCm: event.distanceCm,
      humidityPct: event.humidityPct,
      motion: event.motion,
      flood: event.flood,
      landslide: event.landslide,
      trespass: event.trespass,
      action: event.action,
      acknowledgedAt: event.acknowledgedAt?.toISOString() ?? null,
      acknowledgedBy: event.acknowledgedBy,
      createdAt: event.createdAt.toISOString(),
    })),
    hasMoreEvents: events.length > 25,
  };
}
