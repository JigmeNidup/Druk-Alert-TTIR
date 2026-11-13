import { prisma } from "./db";
import {
  ALERT_STARTED,
  RESOLVED_ACKNOWLEDGED,
  RESOLVED_UNACKNOWLEDGED,
} from "./events";
import { distanceSample, flag, humiditySample, motion } from "./telemetry";
import type { RaisedAlert } from "./types";
import { CLEAR_STATUS, SENSOR_OFFLINE, zoneById, type ZoneId } from "./zones";

const SAMPLE_INTERVAL_MS = 60_000;
const HISTORY_WINDOW_MS = 70 * 60 * 1000;

type ZoneSnapshot = {
  zone: ZoneId;
  alert: boolean;
  sensorFault: boolean;
  distanceCm: number | null;
  humidityPct: number | null;
  motion: boolean | null;
};

export async function ingestTelemetry(payload: Record<string, unknown>) {
  const flood = flag(payload.flood_alert);
  const landslide = flag(payload.landslide_alert);
  const trespass = flag(payload.trespass_alert);
  const floodDistance = distanceSample(payload.flood_dist);
  const floodHumidity = humiditySample(payload.flood_hum);
  const landDistance = distanceSample(payload.land_dist);
  const landHumidity = humiditySample(payload.land_hum);
  const gateDistance = distanceSample(payload.trespass_dist);
  const gateMotion = motion(payload.motion);

  const snapshots: ZoneSnapshot[] = [
    {
      zone: "flood",
      alert: flood,
      sensorFault: floodDistance.failed || floodHumidity.failed,
      distanceCm: floodDistance.value,
      humidityPct: floodHumidity.value,
      motion: null,
    },
    {
      zone: "landslide",
      alert: landslide,
      sensorFault: landDistance.failed || landHumidity.failed,
      distanceCm: landDistance.value,
      humidityPct: landHumidity.value,
      motion: null,
    },
    {
      zone: "trespass",
      alert: trespass,
      sensorFault: gateDistance.failed || gateMotion == null,
      distanceCm: gateDistance.value,
      humidityPct: null,
      motion: gateMotion,
    },
  ];

  return prisma.$transaction(async (tx) => {
    const existing = await tx.zoneStatus.findMany();
    const previous = new Map(existing.map((row) => [row.zone, row.alert]));
    const raised: RaisedAlert[] = [];
    const now = new Date();

    for (const snapshot of snapshots) {
      const meta = zoneById(snapshot.zone);
      if (!meta) continue;
      const status = snapshot.alert
        ? meta.alertStatus
        : snapshot.sensorFault
          ? SENSOR_OFFLINE
          : CLEAR_STATUS;

      await tx.zoneStatus.upsert({
        where: { zone: snapshot.zone },
        update: {
          name: meta.name,
          status,
          distanceCm: snapshot.distanceCm,
          humidityPct: snapshot.humidityPct,
          motion: snapshot.motion,
          alert: snapshot.alert,
          sensorFault: snapshot.sensorFault,
        },
        create: {
          zone: snapshot.zone,
          name: meta.name,
          status,
          distanceCm: snapshot.distanceCm,
          humidityPct: snapshot.humidityPct,
          motion: snapshot.motion,
          alert: snapshot.alert,
          sensorFault: snapshot.sensorFault,
        },
      });

      const latest = await tx.zoneReading.findFirst({
        where: { zone: snapshot.zone },
        orderBy: { recordedAt: "desc" },
      });
      const minuteElapsed =
        !latest || now.getTime() - latest.recordedAt.getTime() >= SAMPLE_INTERVAL_MS;
      const stateChanged =
        !!latest &&
        (latest.alert !== snapshot.alert || latest.sensorFault !== snapshot.sensorFault);

      if (minuteElapsed || stateChanged) {
        await tx.zoneReading.create({
          data: {
            zone: snapshot.zone,
            distanceCm: snapshot.distanceCm,
            humidityPct: snapshot.humidityPct,
            motion: snapshot.motion,
            alert: snapshot.alert,
            sensorFault: snapshot.sensorFault,
            recordedAt: now,
          },
        });
        await tx.zoneReading.deleteMany({
          where: {
            zone: snapshot.zone,
            recordedAt: { lt: new Date(now.getTime() - HISTORY_WINDOW_MS) },
          },
        });
      }

      if (snapshot.alert && !previous.get(snapshot.zone)) {
        await tx.hazardEvent.create({
          data: {
            zone: snapshot.zone,
            status,
            distanceCm: snapshot.distanceCm,
            humidityPct: snapshot.humidityPct,
            motion: snapshot.motion,
            flood,
            landslide,
            trespass,
            action: ALERT_STARTED,
          },
        });
        raised.push({
          zone: snapshot.zone,
          zoneName: meta.name,
          status,
          distanceCm: snapshot.distanceCm,
          humidityPct: snapshot.humidityPct,
        });
      }

      const prior = existing.find((row) => row.zone === snapshot.zone);
      const nowNormal = !snapshot.alert && !snapshot.sensorFault;
      const enteredNormal = nowNormal && !!prior && (prior.alert || prior.sensorFault);
      if (enteredNormal) {
        const started = await tx.hazardEvent.findFirst({
          where: { zone: snapshot.zone, action: ALERT_STARTED },
          orderBy: { createdAt: "desc" },
        });
        if (started) {
          const alreadyResolved = await tx.hazardEvent.findFirst({
            where: {
              zone: snapshot.zone,
              createdAt: { gt: started.createdAt },
              action: { in: [RESOLVED_ACKNOWLEDGED, RESOLVED_UNACKNOWLEDGED] },
            },
          });
          if (!alreadyResolved) {
            const acknowledged = Boolean(started.acknowledgedAt && started.acknowledgedBy);
            await tx.hazardEvent.create({
              data: {
                zone: snapshot.zone,
                status: "Resolved",
                distanceCm: snapshot.distanceCm,
                humidityPct: snapshot.humidityPct,
                motion: snapshot.motion,
                flood,
                landslide,
                trespass,
                action: acknowledged ? RESOLVED_ACKNOWLEDGED : RESOLVED_UNACKNOWLEDGED,
                acknowledgedAt: acknowledged ? started.acknowledgedAt : null,
                acknowledgedBy: acknowledged ? started.acknowledgedBy : null,
              },
            });
          }
        }
      }
    }

    return raised;
  });
}
