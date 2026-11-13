import mqtt from "mqtt";

const broker = process.env.MQTT_BROKER || "broker.hivemq.com";
const port = Number(process.env.MQTT_PORT || 1883);
const topic = process.env.MQTT_TOPIC || "drukalert/zone/telemetry";
const intervalMs = 3000;
const repeatsPerScene = 2;

const scenes = [
  "clear",
  "flood",
  "clear",
  "landslide",
  "clear",
  "trespass",
  "clear",
  "approach",
  "clear",
  "blind",
  "all",
] as const;

type Scene = (typeof scenes)[number];

type Packet = {
  station: string;
  flood_dist: number;
  flood_hum: number | null;
  land_dist: number;
  land_hum: number | null;
  trespass_dist: number;
  motion: 0 | 1;
  flood_alert: 0 | 1;
  landslide_alert: 0 | 1;
  trespass_alert: 0 | 1;
};

const named = new Set<string>(scenes);

function sceneFromArgs(): Scene | "tour" {
  const requested = process.argv.slice(2).find((arg) => !arg.startsWith("-"));
  if (!requested) return "tour";
  if (!named.has(requested)) {
    console.error(`Unknown scene "${requested}". Use one of: ${scenes.join(", ")}`);
    process.exit(1);
  }
  return requested as Scene;
}

function once() {
  return process.argv.includes("--once");
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function drift(center: number, spread: number) {
  return round1(center + (Math.random() * 2 - 1) * spread);
}

function packet(scene: Scene): Packet {
  const body: Packet = {
    station: "TTI Multi-Array Hub",
    flood_dist: drift(88, 4),
    flood_hum: drift(42, 3),
    land_dist: drift(170, 8),
    land_hum: drift(36, 3),
    trespass_dist: drift(140, 8),
    motion: 0,
    flood_alert: 0,
    landslide_alert: 0,
    trespass_alert: 0,
  };

  if (scene === "flood" || scene === "all") {
    body.flood_dist = drift(18, 4);
    body.flood_hum = drift(91, 2);
    body.flood_alert = 1;
  }

  if (scene === "landslide" || scene === "all") {
    body.land_dist = drift(75, 8);
    body.land_hum = drift(88, 2);
    body.landslide_alert = 1;
  }

  if (scene === "trespass" || scene === "all") {
    body.trespass_dist = drift(28, 6);
    body.motion = 1;
    body.trespass_alert = 1;
  }

  if (scene === "approach") {
    body.trespass_dist = drift(32, 5);
    body.motion = 0;
    body.trespass_alert = 1;
  }

  if (scene === "blind") {
    body.flood_dist = -1;
    body.flood_hum = null;
    body.land_dist = -1;
    body.land_hum = null;
    body.trespass_dist = -1;
    body.motion = 0;
    body.flood_alert = 0;
    body.landslide_alert = 0;
    body.trespass_alert = 0;
  }

  return body;
}

function label(body: Packet) {
  const active = [
    body.flood_alert ? "flood" : "",
    body.landslide_alert ? "landslide" : "",
    body.trespass_alert ? "trespass" : "",
  ].filter(Boolean);
  if (active.length) return active.join("+");
  if (body.flood_dist < 0 || body.land_dist < 0 || body.trespass_dist < 0) return "blind";
  return "clear";
}

const mode = sceneFromArgs();
const singlePacket = once();

const client = mqtt.connect(`mqtt://${broker}:${port}`, {
  clientId: `drukalert-sim-${Math.random().toString(16).slice(2, 10)}`,
  reconnectPeriod: 3000,
  connectTimeout: 10_000,
});

let timer: ReturnType<typeof setInterval> | undefined;
let sceneIndex = 0;
let publishedInScene = 0;

function nextScene(): Scene {
  if (mode !== "tour") return mode;
  const scene = scenes[sceneIndex] ?? "clear";
  publishedInScene += 1;
  if (publishedInScene >= repeatsPerScene) {
    publishedInScene = 0;
    sceneIndex = (sceneIndex + 1) % scenes.length;
  }
  return scene;
}

function publishOne() {
  const key = process.env.MQTT_INGEST_KEY?.trim();
  if (!key) {
    console.error("[sim] MQTT_INGEST_KEY is not set.");
    shutdown();
    return;
  }
  const scene = nextScene();
  const body = { ...packet(scene), key };
  client.publish(topic, JSON.stringify(body), { qos: 1 }, (error) => {
    if (error) {
      console.error("[sim] Publish failed.", error.message);
      return;
    }
    console.log(
      `[sim] ${label(body)}  flood ${body.flood_dist}cm/${body.flood_hum}%  land ${body.land_dist}cm/${body.land_hum}%  gate ${body.trespass_dist}cm motion ${body.motion}`,
    );
    if (singlePacket) shutdown();
  });
}

function shutdown() {
  if (timer) clearInterval(timer);
  const force = (process as unknown as { reallyExit?: (code: number) => never }).reallyExit;
  if (force) force(0);
  process.exit(0);
}

client.on("connect", () => {
  console.log(`[sim] Publishing to ${broker}:${port} ${topic} every ${intervalMs / 1000}s`);
  console.log(
    mode === "tour"
      ? "[sim] Tour: clear, flood, landslide, trespass, approach, blind sensors, then all three. Ctrl+C to stop."
      : `[sim] Holding "${mode}".${singlePacket ? " One packet, then exit." : " Ctrl+C to stop."}`,
  );
  publishOne();
  if (!singlePacket) timer = setInterval(publishOne, intervalMs);
});

client.on("error", (error) => {
  console.error("[sim]", error.message);
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
