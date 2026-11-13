import type { ZoneKind } from "./zones";

export type ZoneView = {
  zone: string;
  name: string;
  hazard: string;
  kind: ZoneKind;
  summary: string;
  status: string;
  distanceCm: number | null;
  humidityPct: number | null;
  motion: boolean | null;
  alert: boolean;
  sensorFault: boolean;
  updatedAt: string;
  readings: ReadingPoint[];
};

export type ReadingPoint = {
  recordedAt: string;
  distanceCm: number | null;
  humidityPct: number | null;
};

export type EventView = {
  id: string;
  zone: string;
  zoneName: string;
  status: string;
  distanceCm: number | null;
  humidityPct: number | null;
  motion: boolean | null;
  flood: boolean;
  landslide: boolean;
  trespass: boolean;
  action: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  createdAt: string;
};

export type StatusPayload = {
  zones: ZoneView[];
  events: EventView[];
  hasMoreEvents: boolean;
};

export type RaisedAlert = {
  zone: string;
  zoneName: string;
  status: string;
  distanceCm: number | null;
  humidityPct: number | null;
};
