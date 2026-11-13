import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export const SESSION_COOKIE = "drukalert_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type SessionUser = {
  id: string;
  username: string;
  isAdmin: boolean;
};

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};

function secretKey() {
  const secret = process.env.SESSION_SECRET?.trim() ?? "";
  if (secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(user: SessionUser) {
  return new SignJWT({ username: user.username, isAdmin: user.isAdmin })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return readSession(payload);
  } catch {
    return null;
  }
}

function readSession(payload: JWTPayload): SessionUser | null {
  if (typeof payload.sub !== "string" || typeof payload.username !== "string") {
    return null;
  }
  return {
    id: payload.sub,
    username: payload.username,
    isAdmin: payload.isAdmin === true,
  };
}
