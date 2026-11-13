import type { ReadingPoint } from "./types";

const WIDTH = 240;
const HEIGHT = 56;

export function chartSegments(points: ReadingPoint[], key: "distanceCm" | "humidityPct") {
  const values = points.map((point) => point[key]);
  const numbers = values.filter((value): value is number => value != null);
  if (numbers.length < 2) return [];

  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  const span = max - min || 1;
  const step = WIDTH / Math.max(values.length - 1, 1);
  const segments: string[] = [];
  let current: string[] = [];

  values.forEach((value, index) => {
    if (value == null) {
      if (current.length > 1) segments.push(current.join(" "));
      current = [];
      return;
    }
    const x = (index * step).toFixed(1);
    const y = (HEIGHT - ((value - min) / span) * (HEIGHT - 4) - 2).toFixed(1);
    current.push(`${x},${y}`);
  });

  if (current.length > 1) segments.push(current.join(" "));
  return segments;
}

export const CHART_VIEW = { width: WIDTH, height: HEIGHT };
