import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "./session";

export async function getSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}
