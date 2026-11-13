import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getSession } from "@/lib/auth";
import { telegramBotLink } from "@/lib/telegram";

export default function LoginPage() {
  return (
    <main className="grid min-h-full place-items-center px-4 py-12">
      <Suspense fallback={<LoginFrame checking />}>
        <LoginScreen />
      </Suspense>
    </main>
  );
}

async function LoginScreen() {
  const session = await getSession();
  if (session) redirect("/dashboard");
  return <LoginFrame />;
}

function LoginFrame({ checking = false }: { checking?: boolean }) {
  return (
    <section className="w-full max-w-md rounded-2xl border border-edge bg-surface/95 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-sm font-semibold text-[#07111f]">
          DA
        </span>
        <div>
          <p className="text-[11px] font-medium tracking-[0.18em] text-muted uppercase">
            TTI Rangjung
          </p>
          <h1 className="text-xl font-semibold tracking-tight">DrukAlert</h1>
        </div>
      </div>
      <p className="mb-6 text-sm leading-6 text-muted">
        Zone monitoring for the main gate, the mountain above it, and the river
        along the railing.
      </p>
      {checking ? (
        <p className="text-sm text-muted">Checking session...</p>
      ) : (
        <LoginForm />
      )}
      <a
        href={telegramBotLink()}
        target="_blank"
        rel="noreferrer"
        className="mt-5 inline-block text-sm text-accent underline-offset-4 hover:underline"
      >
        Open the Telegram bot
      </a>
    </section>
  );
}
