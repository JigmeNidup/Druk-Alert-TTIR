import mqtt from "mqtt";
import { prisma } from "../lib/db";
import { ingestTelemetry } from "../lib/ingest";
import { sendTelegramAlert, telegramEnabled } from "../lib/telegram";
import { ingestAuthorized, isEspPayload, parseTelemetry } from "../lib/telemetry";

const broker = process.env.MQTT_BROKER || "broker.hivemq.com";
const port = Number(process.env.MQTT_PORT || 1883);
const topic = process.env.MQTT_TOPIC || "drukalert/zone/telemetry";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env and start Postgres.");
  process.exit(1);
}

const client = mqtt.connect(`mqtt://${broker}:${port}`, {
  clientId: `drukalert-console-${Math.random().toString(16).slice(2, 10)}`,
  reconnectPeriod: 3000,
  connectTimeout: 10_000,
});

let chain: Promise<void> = Promise.resolve();

client.on("connect", () => {
  console.log(`[mqtt] Connected to ${broker}:${port}`);
  console.log(
    telegramEnabled()
      ? "[mqtt] Telegram alerts are enabled."
      : "[mqtt] Telegram alerts are off. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to enable them.",
  );
  client.subscribe(topic, { qos: 1 }, (error) => {
    if (error) {
      console.error("[mqtt] Subscribe failed.", error);
      return;
    }
    console.log(`[mqtt] Listening on ${topic}`);
    if (!process.env.MQTT_INGEST_KEY?.trim()) {
      console.error("[mqtt] MQTT_INGEST_KEY is not set. Telemetry will be refused.");
    }
  });
});

client.on("message", (_topic, payload) => {
  chain = chain
    .then(() => handleMessage(payload.toString("utf8")))
    .catch((error) => {
      console.error("[mqtt] Failed to store telemetry.", error);
    });
});

client.on("error", (error) => {
  console.error("[mqtt]", error.message);
});

client.on("reconnect", () => {
  console.log("[mqtt] Reconnecting...");
});

async function handleMessage(raw: string) {
  const payload = parseTelemetry(raw);
  if (!payload || !isEspPayload(payload)) {
    console.warn("[mqtt] Ignored a packet that is not ESP32 zone telemetry.");
    return;
  }
  if (!ingestAuthorized(payload)) {
    console.warn("[mqtt] Ignored a packet with a missing or wrong ingest key.");
    return;
  }

  const raised = await ingestTelemetry(payload);
  const flood = payload.flood_alert ?? 0;
  const landslide = payload.landslide_alert ?? 0;
  const trespass = payload.trespass_alert ?? 0;
  console.log(
    `[mqtt] flood=${flood} landslide=${landslide} trespass=${trespass}${
      raised.length ? ` new=${raised.map((alert) => alert.zone).join(",")}` : ""
    }`,
  );

  for (const alert of raised) {
    try {
      await sendTelegramAlert(alert);
    } catch (error) {
      console.error("[telegram]", error);
    }
  }
}

async function shutdown() {
  client.end(true);
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});
