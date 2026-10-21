import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { mapsUrl } from "@/lib/format";
import { TIME_ZONE } from "@/lib/limits";
import { exportVisits, filtersFromSearchParams } from "@/lib/visits";

// Excel has no time zones, so write India-time wall-clock values as text-free dates.
function toIst(d: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")));
}

const link = (url: string, text = url) => ({ text, hyperlink: url });

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const filters = filtersFromSearchParams(Object.fromEntries(req.nextUrl.searchParams));
  const data = await exportVisits(filters);
  // Photos live in a private store, so links go through the app (sign-in required).
  const photoUrl = (id: string) => new URL(`/photos/${id}`, req.nextUrl.origin).toString();

  const wb = new ExcelJS.Workbook();
  wb.creator = "MCCIA HOD Industry Visit";
  const dateFmt = "dd-mmm-yyyy hh:mm AM/PM";

  const visitSheet = wb.addWorksheet("Visits");
  visitSheet.columns = [
    { header: "Submitted (IST)", key: "createdAt", width: 22, style: { numFmt: dateFmt } },
    { header: "HOD", key: "hod", width: 24 },
    { header: "Email", key: "email", width: 28 },
    { header: "Department", key: "dept", width: 22 },
    { header: "Company", key: "company", width: 30 },
    { header: "Accompanying Members", key: "members", width: 30 },
    { header: "Purpose", key: "purpose", width: 50 },
    { header: "Photos", key: "count", width: 8 },
    { header: "Photo Links", key: "photos", width: 60 },
    { header: "Map Links", key: "maps", width: 50 },
    { header: "Visit ID", key: "id", width: 38 },
  ];

  const photoSheet = wb.addWorksheet("Photos");
  photoSheet.columns = [
    { header: "Visit ID", key: "visitId", width: 38 },
    { header: "Company", key: "company", width: 30 },
    { header: "HOD", key: "hod", width: 24 },
    { header: "Source", key: "source", width: 10 },
    { header: "Captured (IST)", key: "capturedAt", width: 22, style: { numFmt: dateFmt } },
    { header: "Uploaded (IST, server)", key: "createdAt", width: 22, style: { numFmt: dateFmt } },
    { header: "Latitude", key: "lat", width: 12 },
    { header: "Longitude", key: "lng", width: 12 },
    { header: "Accuracy (m)", key: "acc", width: 12 },
    { header: "Photo Link", key: "url", width: 40 },
    { header: "Map Link", key: "map", width: 40 },
  ];

  for (const v of data) {
    const maps = v.photos
      .filter((p) => p.latitude !== null && p.longitude !== null)
      .map((p) => mapsUrl(p.latitude!, p.longitude!));
    const row = visitSheet.addRow({
      createdAt: toIst(v.createdAt),
      hod: v.hodName,
      email: v.hodEmail,
      dept: v.department,
      company: v.companyName,
      members: v.accompanyingMembers.join(", "),
      purpose: v.purpose,
      count: v.photos.length,
      photos: v.photos.map((p) => photoUrl(p.id)).join("\n"),
      maps: maps.join("\n"),
      id: v.id,
    });
    row.alignment = { vertical: "top", wrapText: true };

    for (const p of v.photos) {
      const hasLoc = p.latitude !== null && p.longitude !== null;
      photoSheet.addRow({
        visitId: v.id,
        company: v.companyName,
        hod: v.hodName,
        source: p.source === "camera" ? "Camera" : "Uploaded",
        capturedAt: toIst(p.capturedAt),
        createdAt: toIst(p.createdAt),
        lat: p.latitude,
        lng: p.longitude,
        acc: p.accuracyM !== null ? Math.round(p.accuracyM) : null,
        url: link(photoUrl(p.id), "Open photo"),
        map: hasLoc ? link(mapsUrl(p.latitude!, p.longitude!), "Open map") : null,
      });
    }
  }

  for (const sheet of [visitSheet, photoSheet]) {
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF176DAE" } };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
  }
  photoSheet.getColumn("url").font = { color: { argb: "FF0082DE" }, underline: true };
  photoSheet.getColumn("map").font = { color: { argb: "FF0082DE" }, underline: true };

  const buffer = await wb.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="hod-industry-visits-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
