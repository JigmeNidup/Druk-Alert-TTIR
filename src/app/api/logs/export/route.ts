import { NextResponse } from "next/server";
import { toCsv } from "@/lib/csv";
import { prisma } from "@/lib/db";
import { formatStamp } from "@/lib/format";
import { zoneById } from "@/lib/zones";

export async function GET() {
  try {
    const events = await prisma.hazardEvent.findMany({
      orderBy: { createdAt: "asc" },
    });

    const csv = toCsv([
      [
        "Timestamp",
        "Zone",
        "Hazard Status",
        "Distance (cm)",
        "Humidity (%)",
        "Motion",
        "Flood",
        "Landslide",
        "Trespass",
        "Action",
        "Acknowledged By",
        "Acknowledged At",
      ],
      ...events.map((event) => [
        formatStamp(event.createdAt),
        zoneById(event.zone)?.name ?? event.zone,
        event.status,
        event.distanceCm == null ? "" : event.distanceCm.toFixed(1),
        event.humidityPct == null ? "" : event.humidityPct.toFixed(1),
        event.motion == null ? "" : event.motion ? "1" : "0",
        event.flood ? "1" : "0",
        event.landslide ? "1" : "0",
        event.trespass ? "1" : "0",
        event.action,
        event.acknowledgedBy ?? "",
        event.acknowledgedAt ? formatStamp(event.acknowledgedAt) : "",
      ]),
    ]);

    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="drukalert-hazard-log.csv"',
      },
    });
  } catch (error) {
    console.error("[logs]", error);
    return NextResponse.json({ error: "The hazard log is unavailable." }, { status: 503 });
  }
}
