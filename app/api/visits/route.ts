import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { visitPhotos, visits } from "@/lib/db/schema";
import { parseVisitInput } from "@/lib/visit-input";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = parseVisitInput(body, user.id);
  if (!parsed.ok) return NextResponse.json({ error: "Please fix the highlighted fields.", errors: parsed.errors }, { status: 400 });

  const { companyName, accompanyingMembers, purpose, photos } = parsed.value;
  const visitId = crypto.randomUUID();

  // One transaction so a visit is never saved without its photos. created_at
  // defaults to server time on both tables for the audit trail.
  await db.transaction(async (tx) => {
    await tx.insert(visits).values({ id: visitId, hodId: user.id, companyName, accompanyingMembers, purpose });
    await tx.insert(visitPhotos).values(
      photos.map((p) => ({
        visitId,
        blobUrl: p.blobUrl,
        source: p.source,
        capturedAt: new Date(p.capturedAt),
        latitude: p.latitude,
        longitude: p.longitude,
        accuracyM: p.accuracyM,
      })),
    );
  });

  return NextResponse.json({ id: visitId }, { status: 201 });
}
