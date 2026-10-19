import { MAX_COMPANY, MAX_MEMBERS, MAX_MEMBER_NAME, MAX_PHOTOS, MAX_PURPOSE } from "./limits";

export type PhotoInput = {
  blobUrl: string;
  source: "camera" | "upload";
  capturedAt: string;
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
};

export type VisitInput = {
  companyName: string;
  accompanyingMembers: string[];
  purpose: string;
  photos: PhotoInput[];
};

type Result = { ok: true; value: VisitInput } | { ok: false; errors: Record<string, string> };

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Only accept photos this HOD uploaded to our Blob store via /api/photos. */
function isOwnBlobUrl(url: string, hodId: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com") && u.pathname.startsWith(`/visits/${hodId}/`);
  } catch {
    return false;
  }
}

export function parseVisitInput(body: unknown, hodId: string, now = new Date()): Result {
  const errors: Record<string, string> = {};
  const b = (body ?? {}) as Record<string, unknown>;

  const companyName = typeof b.companyName === "string" ? b.companyName.trim() : "";
  if (!companyName) errors.companyName = "Company name is required.";
  else if (companyName.length > MAX_COMPANY) errors.companyName = `Keep it under ${MAX_COMPANY} characters.`;

  const purpose = typeof b.purpose === "string" ? b.purpose.trim() : "";
  if (!purpose) errors.purpose = "Purpose of visit is required.";
  else if (purpose.length > MAX_PURPOSE) errors.purpose = `Keep it under ${MAX_PURPOSE} characters.`;

  const rawMembers = Array.isArray(b.accompanyingMembers) ? b.accompanyingMembers : [];
  const accompanyingMembers = rawMembers
    .filter((m): m is string => typeof m === "string")
    .map((m) => m.trim())
    .filter(Boolean);
  if (accompanyingMembers.length > MAX_MEMBERS) errors.accompanyingMembers = `Up to ${MAX_MEMBERS} members.`;
  else if (accompanyingMembers.some((m) => m.length > MAX_MEMBER_NAME)) errors.accompanyingMembers = "A member name is too long.";

  const rawPhotos = Array.isArray(b.photos) ? b.photos : [];
  const photos: PhotoInput[] = [];
  const latest = now.getTime() + 60 * 60 * 1000; // tolerate device clock drift
  for (const raw of rawPhotos) {
    const p = (raw ?? {}) as Record<string, unknown>;
    const source = p.source === "camera" || p.source === "upload" ? p.source : null;
    const capturedAt = typeof p.capturedAt === "string" ? new Date(p.capturedAt) : null;
    const blobUrl = typeof p.blobUrl === "string" ? p.blobUrl : "";
    const lat = isNum(p.latitude) ? p.latitude : null;
    const lng = isNum(p.longitude) ? p.longitude : null;
    const acc = isNum(p.accuracyM) ? p.accuracyM : null;
    const hasLocation = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

    if (!source || !capturedAt || Number.isNaN(capturedAt.getTime()) || !isOwnBlobUrl(blobUrl, hodId)) {
      errors.photos = "One of the photos is invalid. Please remove it and add it again.";
      break;
    }
    if (capturedAt.getTime() > latest) {
      errors.photos = "A photo's date and time is in the future.";
      break;
    }
    if (source === "camera" && !hasLocation) {
      errors.photos = "Camera photos must include location.";
      break;
    }
    photos.push({
      blobUrl,
      source,
      capturedAt: capturedAt.toISOString(),
      latitude: hasLocation ? lat : null,
      longitude: hasLocation ? lng : null,
      accuracyM: hasLocation && acc !== null && acc >= 0 ? acc : null,
    });
  }
  if (!errors.photos) {
    if (photos.length === 0) errors.photos = "Add at least one photo.";
    else if (photos.length > MAX_PHOTOS) errors.photos = `Up to ${MAX_PHOTOS} photos per report.`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { companyName, accompanyingMembers, purpose, photos } };
}
