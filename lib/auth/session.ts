import { SignJWT, jwtVerify } from "jose";

/**
 * Signed session cookie. Edge-safe (no DB, no Node APIs) so proxy.ts can use it.
 * The cookie only carries the HOD id; role and active status are re-read from
 * the database on every request in lib/auth/index.ts.
 */
export const SESSION_COOKIE = "hiv_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type SessionPayload = { hodId: string };

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ hodId: payload.hodId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return typeof payload.hodId === "string" ? { hodId: payload.hodId } : null;
  } catch {
    return null;
  }
}
