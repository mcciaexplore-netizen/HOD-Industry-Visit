import { get } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { visitPhotos, visits } from "@/lib/db/schema";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Streams a photo from the private Blob store. Only the HOD who reported the
// visit and admins can see it. Outside /api so a signed-out click (e.g. from
// the Excel export) is redirected to /login by proxy.ts.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const { id } = await params;
  const notFound = () => new NextResponse("Photo not found.", { status: 404 });
  if (!UUID.test(id)) return notFound();

  const [photo] = await db
    .select({ blobUrl: visitPhotos.blobUrl, hodId: visits.hodId })
    .from(visitPhotos)
    .innerJoin(visits, eq(visits.id, visitPhotos.visitId))
    .where(eq(visitPhotos.id, id))
    .limit(1);
  if (!photo || (user.role !== "admin" && photo.hodId !== user.id)) return notFound();

  const blob = await get(photo.blobUrl, { access: "private" });
  if (!blob || blob.statusCode !== 200) return notFound();

  return new NextResponse(blob.stream, {
    headers: {
      "Content-Type": blob.blob.contentType,
      "Content-Length": String(blob.blob.size),
      // Photos never change once uploaded; keep them out of shared caches.
      "Cache-Control": "private, max-age=86400, immutable",
    },
  });
}
