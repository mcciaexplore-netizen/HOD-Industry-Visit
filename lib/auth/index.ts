import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "../db";
import { hods } from "../db/schema";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, signSession, verifySession } from "./session";

/**
 * The only auth surface the rest of the app uses. To move to App Hub single
 * sign-on later, change how `getCurrentUser` resolves the person (e.g. verify
 * the App Hub token and look the HOD up by email) and replace the login page;
 * pages, API routes and queries only ever see `CurrentUser`.
 */
export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  department: string;
  role: "hod" | "admin";
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const [hod] = await db.select().from(hods).where(eq(hods.id, session.hodId)).limit(1);
  if (!hod || !hod.active) return null;
  return { id: hod.id, name: hod.name, email: hod.email, department: hod.department, role: hod.role };
});

/** For pages: redirects to /login when signed out. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** For pages: sends non-admins back to the report form. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

export async function startSession(hodId: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession({ hodId }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
