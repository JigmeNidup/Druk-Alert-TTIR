import { NextResponse } from "next/server";
import { getStatus } from "@/lib/status";

export async function GET() {
  try {
    return NextResponse.json(await getStatus());
  } catch (error) {
    console.error("[status]", error);
    return NextResponse.json(
      { error: "Zone status is unavailable." },
      { status: 503 },
    );
  }
}
