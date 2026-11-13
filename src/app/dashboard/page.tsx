import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { getSession } from "@/lib/auth";
import { getStatus } from "@/lib/status";
import { telegramBotLink } from "@/lib/telegram";

export const metadata = {
  title: "Console",
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const status = await getStatus();

  return (
    <Dashboard
      initial={status}
      username={session.username}
      isAdmin={session.isAdmin}
      botLink={telegramBotLink()}
    />
  );
}
