import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ALERT_STARTED } from "@/lib/events";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const event = await prisma.hazardEvent.findUnique({ where: { id } });
  if (!event) {
    return NextResponse.json({ error: "That alert is no longer in the log." }, { status: 404 });
  }

  if (event.action !== ALERT_STARTED) {
    return NextResponse.json({ error: "Only an alert that started can be acknowledged." }, { status: 409 });
  }

  if (event.acknowledgedAt && event.acknowledgedBy) {
    return NextResponse.json({
      acknowledgedAt: event.acknowledgedAt.toISOString(),
      acknowledgedBy: event.acknowledgedBy,
    });
  }

  const saved = await prisma.hazardEvent.update({
    where: { id },
    data: {
      acknowledgedAt: new Date(),
      acknowledgedBy: session.username,
    },
  });

  return NextResponse.json({
    acknowledgedAt: saved.acknowledgedAt?.toISOString() ?? null,
    acknowledgedBy: saved.acknowledgedBy,
  });
}
