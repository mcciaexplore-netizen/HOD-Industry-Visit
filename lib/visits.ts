import "server-only";
import { and, asc, count, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "./db";
import { hods, visitPhotos, visits } from "./db/schema";


const photoCount = sql<number>`(select count(*)::int from ${visitPhotos} where ${visitPhotos.visitId} = ${visits.id})`;

const listColumns = {
  id: visits.id,
  companyName: visits.companyName,
  purpose: visits.purpose,
  accompanyingMembers: visits.accompanyingMembers,
  createdAt: visits.createdAt,
  hodId: visits.hodId,
  hodName: hods.name,
  hodEmail: hods.email,
  department: hods.department,
  photoCount,
};

export type VisitListItem = Awaited<ReturnType<typeof listVisitsForHod>>[number];

export async function listVisitsForHod(hodId: string) {
  return db
    .select(listColumns)
    .from(visits)
    .innerJoin(hods, eq(hods.id, visits.hodId))
    .where(eq(visits.hodId, hodId))
    .orderBy(desc(visits.createdAt));
}

export async function getVisitDetail(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [visit] = await db.select(listColumns).from(visits).innerJoin(hods, eq(hods.id, visits.hodId)).where(eq(visits.id, id)).limit(1);
  if (!visit) return null;
  const photos = await db.select().from(visitPhotos).where(eq(visitPhotos.visitId, id)).orderBy(asc(visitPhotos.capturedAt));
  return { ...visit, photos };
}

export type VisitDetailData = NonNullable<Awaited<ReturnType<typeof getVisitDetail>>>;

// ---------- Admin ----------

export type AdminFilters = {
  hod?: string;
  dept?: string;
  company?: string;
  from?: string; // yyyy-mm-dd, India time
  to?: string;
  q?: string;
};

export const ADMIN_PAGE_SIZE = 50;

function likeTerm(value: string): string {
  return `%${value.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function adminWhere(f: AdminFilters): SQL | undefined {
  const parts: (SQL | undefined)[] = [];
  if (f.hod) parts.push(eq(visits.hodId, f.hod));
  if (f.dept) parts.push(eq(hods.department, f.dept));
  if (f.company) parts.push(ilike(visits.companyName, likeTerm(f.company)));
  // Date range is interpreted in India time, inclusive of both days.
  if (f.from && ISO_DATE.test(f.from)) parts.push(gte(visits.createdAt, new Date(`${f.from}T00:00:00+05:30`)));
  if (f.to && ISO_DATE.test(f.to)) parts.push(lte(visits.createdAt, new Date(`${f.to}T23:59:59.999+05:30`)));
  if (f.q) {
    const term = likeTerm(f.q);
    parts.push(
      or(
        ilike(visits.companyName, term),
        ilike(visits.purpose, term),
        ilike(hods.name, term),
        ilike(hods.email, term),
        sql`array_to_string(${visits.accompanyingMembers}, ' ') ilike ${term}`,
      ),
    );
  }
  return and(...parts);
}

export async function listVisitsForAdmin(filters: AdminFilters, page: number) {
  const where = adminWhere(filters);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select(listColumns)
      .from(visits)
      .innerJoin(hods, eq(hods.id, visits.hodId))
      .where(where)
      .orderBy(desc(visits.createdAt))
      .limit(ADMIN_PAGE_SIZE)
      .offset((page - 1) * ADMIN_PAGE_SIZE),
    db.select({ total: count() }).from(visits).innerJoin(hods, eq(hods.id, visits.hodId)).where(where),
  ]);
  return { rows, total };
}

/** Every matching visit with its photos, for the Excel export. */
export async function exportVisits(filters: AdminFilters) {
  const rows = await db
    .select({
      visit: listColumns,
      photo: visitPhotos,
    })
    .from(visits)
    .innerJoin(hods, eq(hods.id, visits.hodId))
    .leftJoin(visitPhotos, eq(visitPhotos.visitId, visits.id))
    .where(adminWhere(filters))
    .orderBy(desc(visits.createdAt), asc(visitPhotos.capturedAt));

  const byId = new Map<string, VisitDetailData>();
  for (const { visit, photo } of rows) {
    let entry = byId.get(visit.id);
    if (!entry) {
      entry = { ...visit, photos: [] };
      byId.set(visit.id, entry);
    }
    if (photo) entry.photos.push(photo);
  }
  return [...byId.values()];
}

export async function filterOptions() {
  const [hodRows, deptRows] = await Promise.all([
    db.select({ id: hods.id, name: hods.name, department: hods.department }).from(hods).orderBy(asc(hods.name)),
    db.selectDistinct({ department: hods.department }).from(hods).orderBy(asc(hods.department)),
  ]);
  return { hods: hodRows, departments: deptRows.map((d) => d.department).filter(Boolean) };
}

export function filtersFromSearchParams(sp: Record<string, string | string[] | undefined>): AdminFilters {
  const pick = (key: string) => {
    const v = sp[key];
    const s = (Array.isArray(v) ? v[0] : v)?.trim();
    return s ? s.slice(0, 200) : undefined;
  };
  const hod = pick("hod");
  return {
    hod: hod && /^[0-9a-f-]{36}$/i.test(hod) ? hod : undefined,
    dept: pick("dept"),
    company: pick("company"),
    from: pick("from"),
    to: pick("to"),
    q: pick("q"),
  };
}

