import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clearLoginFailures, recordLoginFailure, tooManyLoginAttempts } from "@/lib/login-limit";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  signSession,
} from "@/lib/session";

const DUMMY_PASSWORD_HASH = "$2b$12$QT5SD7qKbvuZXjQUc9v4c.wpQZMYRy1NRLHYW1ajA4wdXma72QnTW";
const MAX_USERNAME = 80;
const MAX_PASSWORD = 128;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Enter your username and password." },
      { status: 400 },
    );
  }

  const username =
    typeof body === "object" && body && "username" in body
      ? String(body.username).trim()
      : "";
  const password =
    typeof body === "object" && body && "password" in body
      ? String(body.password)
      : "";

  if (!username || !password || username.length > MAX_USERNAME || password.length > MAX_PASSWORD) {
    return NextResponse.json(
      { error: "Enter your username and password." },
      { status: 400 },
    );
  }

  if (tooManyLoginAttempts(username)) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Wait a few minutes and try again." },
      { status: 429 },
    );
  }

  try {
    const user = await prisma.user.findUnique({ where: { username } });
    const matches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

    if (!user || !matches) {
      recordLoginFailure(username);
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    clearLoginFailures(username);

    const token = await signSession({
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
    });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    return response;
  } catch (error) {
    console.error("[login]", error);
    return NextResponse.json(
      { error: "Sign-in is unavailable right now. Check that Postgres is running." },
      { status: 503 },
    );
  }
}
