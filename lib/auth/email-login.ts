import "server-only";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { hods } from "../db/schema";
import { normalizeEmail } from "../hods";
import { startSession } from ".";

/**
 * Email-only sign-in against the hods table. This is the piece to replace
 * with App Hub SSO; nothing else depends on it.
 */
export async function signInWithEmail(rawEmail: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = normalizeEmail(rawEmail);
  if (!email) return { ok: false, error: "Enter your email address." };
  const [hod] = await db.select({ id: hods.id, active: hods.active }).from(hods).where(eq(hods.email, email)).limit(1);
  if (!hod) return { ok: false, error: "This email is not registered. Please contact the MCCIA admin." };
  if (!hod.active) return { ok: false, error: "Your access has been deactivated. Please contact the MCCIA admin." };
  await startSession(hod.id);
  return { ok: true };
}
