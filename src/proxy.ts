import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./lib/session";

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (session) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/api/status",
    "/api/logs/:path*",
    "/api/alerts/:path*",
  ],
};
