import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getUserById } from "./db";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_S,
  createSessionToken,
  parseSessionToken,
} from "./auth-crypto";

export type SessionUser = { id: number; email: string; role: "admin" | "member" };

export async function startSession(userId: number) {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE_NAME);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  // Sessions depend on wall-clock expiry — opt out of prerendering entirely.
  await connection();
  const userId = parseSessionToken((await cookies()).get(SESSION_COOKIE_NAME)?.value);
  if (!userId) return null;
  const user = getUserById(userId);
  if (!user || user.blocked) return null; // blocking a member kills their session immediately
  return { id: user.id, email: user.email, role: user.role };
}

/** Page guard — redirects to the login page when not signed in. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/masuk");
  return user;
}

/** Page guard for the admin dashboard. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}
