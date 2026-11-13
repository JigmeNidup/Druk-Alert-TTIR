import type { RaisedAlert } from "./types";

export function parseTelemetry(raw: string): Record<string, unknown> | null {
  // The ESP32 prints "nan" when a DHT read fails, which is not valid JSON.
  const cleaned = raw.replace(/\bNaN\b|\bnan\b|\bInfinity\b|-Infinity/g, "null");
  try {
    const data = JSON.parse(cleaned) as unknown;
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    return data as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function isEspPayload(data: Record<string, unknown>) {
  return (
    "flood_alert" in data &&
    "landslide_alert" in data &&
    "trespass_alert" in data
  );
}

export function ingestAuthorized(data: Record<string, unknown>) {
  const expected = process.env.MQTT_INGEST_KEY?.trim() ?? "";
  const provided = typeof data.key === "string" ? data.key : "";
  if (!expected || provided.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ provided.charCodeAt(index);
  }
  return mismatch === 0;
}

export type Sample = {
  value: number | null;
  failed: boolean;
};

export function distanceSample(value: unknown): Sample {
  const parsed = finite(value);
  if (parsed == null || parsed < 0) return { value: null, failed: true };
  return { value: parsed, failed: false };
}

export function humiditySample(value: unknown): Sample {
  const parsed = finite(value);
  if (parsed == null || parsed < 0) return { value: null, failed: true };
  return { value: parsed, failed: false };
}

export function flag(value: unknown) {
  return value === true || value === 1 || value === "1";
}

export function motion(value: unknown): boolean | null {
  if (value == null) return null;
  if (value === true || value === 1 || value === "1") return true;
  if (value === false || value === 0 || value === "0") return false;
  return null;
}

function finite(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function telegramText(alert: RaisedAlert) {
  const distance =
    alert.distanceCm == null ? "n/a" : `${alert.distanceCm.toFixed(1)} cm`;
  const humidity =
    alert.humidityPct == null ? "n/a" : `${alert.humidityPct.toFixed(1)} %`;

  return [
    "DRUKALERT HAZARD DISPATCH",
    "",
    `Zone: ${alert.zoneName}`,
    `Alert: ${alert.status}`,
    `Distance: ${distance} | Humidity: ${humidity}`,
    "",
    "Authorities dispatched: Sonam Wangdi, Tandin Wangchuk, Lhaki Wangmo, Bemal Bhandari",
  ].join("\n");
}
