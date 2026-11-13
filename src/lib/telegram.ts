import { telegramText } from "./telemetry";
import type { RaisedAlert } from "./types";

const DEFAULT_BOT_LINK = "https://t.me/druk_alert_bot";

let discoveredChatId: string | null = null;

export function telegramBotLink() {
  const configured = process.env.TELEGRAM_BOT_LINK?.trim();
  return configured || DEFAULT_BOT_LINK;
}

type TelegramUpdate = {
  message?: { chat?: { id?: number | string } };
  edited_message?: { chat?: { id?: number | string } };
  channel_post?: { chat?: { id?: number | string } };
  my_chat_member?: { chat?: { id?: number | string } };
};

export async function sendTelegramAlert(alert: RaisedAlert) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const configured = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !configured) return;

  const chatId = await resolveChatId(token, configured);
  if (!chatId) {
    console.warn(
      `[telegram] No chat found. Open ${telegramBotLink()} and send a message, or set TELEGRAM_CHAT_ID to a numeric chat id.`,
    );
    return;
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `${telegramText(alert)}\n\nBot: ${telegramBotLink()}`,
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    const detail = await response
      .json()
      .then((body: { description?: string }) => body.description?.trim() ?? "")
      .catch(() => "");
    throw new Error(
      detail
        ? `Telegram request failed (${response.status}): ${detail}`
        : `Telegram request failed (${response.status}).`,
    );
  }
}

export function telegramEnabled() {
  return Boolean(
    process.env.TELEGRAM_BOT_TOKEN?.trim() && process.env.TELEGRAM_CHAT_ID?.trim(),
  );
}

async function resolveChatId(token: string, configured: string) {
  if (configured !== "auto") return configured;
  if (discoveredChatId) return discoveredChatId;

  const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, {
    signal: AbortSignal.timeout(8000),
  });
  const body = (await response.json()) as { ok?: boolean; result?: TelegramUpdate[] };
  const updates = Array.isArray(body.result) ? body.result : [];

  for (let index = updates.length - 1; index >= 0; index -= 1) {
    const update = updates[index];
    const chat =
      update.message?.chat ??
      update.edited_message?.chat ??
      update.channel_post?.chat ??
      update.my_chat_member?.chat;
    if (chat?.id == null) continue;
    discoveredChatId = String(chat.id);
    console.log(`[telegram] Using chat ${discoveredChatId} from the latest bot update.`);
    return discoveredChatId;
  }

  return null;
}
