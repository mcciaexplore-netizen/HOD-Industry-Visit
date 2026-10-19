import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { MAX_UPLOAD_BYTES } from "@/lib/limits";

// Photos are compressed in the browser, then uploaded one per request so each
// stays well under Vercel's 4.5 MB request body limit.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No photo received." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "Photo is too large." }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!isJpeg) return NextResponse.json({ error: "Only JPEG photos are accepted." }, { status: 415 });

  const blob = await put(`visits/${user.id}/${crypto.randomUUID()}.jpg`, Buffer.from(bytes), {
    access: "public",
    contentType: "image/jpeg",
  });
  return NextResponse.json({ url: blob.url });
}
