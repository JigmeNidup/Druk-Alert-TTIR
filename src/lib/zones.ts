export const ZONES = [
  {
    id: "trespass",
    name: "TTIR Main Gate",
    hazard: "Trespass",
    kind: "gate",
    alertStatus: "Trespass detected",
    summary: "Motion at the gate, or an approach closer than 50 cm.",
  },
  {
    id: "landslide",
    name: "Mountain Above TTIR Gate",
    hazard: "Landslide",
    kind: "slope",
    alertStatus: "Landslide hazard",
    summary: "Humidity above 80% and slope movement between 40 and 120 cm.",
  },
  {
    id: "flood",
    name: "River Alongside Railing",
    hazard: "Flood",
    kind: "water",
    alertStatus: "Flood hazard",
    summary: "Humidity above 80% and water closer than 40 cm.",
  },
] as const;

export const SENSOR_OFFLINE = "Sensor offline";
export const AWAITING_TELEMETRY = "Awaiting telemetry";
export const CLEAR_STATUS = "Clear";

export type ZoneId = (typeof ZONES)[number]["id"];
export type ZoneKind = (typeof ZONES)[number]["kind"];

export function zoneById(id: string) {
  return ZONES.find((zone) => zone.id === id);
}
