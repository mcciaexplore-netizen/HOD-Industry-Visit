import { sql } from "drizzle-orm";
import { parseCsv } from "./csv";
import { db } from "./db";
import { hods } from "./db/schema";

export type HodInput = { name: string; email: string; department: string; role: "hod" | "admin" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

/**
 * Parses "name,email,department[,role]" CSV. A header row is optional.
 * Returns valid rows plus a readable error per rejected line.
 */
export function parseHodCsv(text: string): { rows: HodInput[]; errors: string[] } {
  const lines = parseCsv(text);
  const rows: HodInput[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  lines.forEach((cells, index) => {
    const [rawName = "", rawEmail = "", rawDept = "", rawRole = ""] = cells.map((c) => c.trim());
    if (index === 0 && rawEmail.toLowerCase() === "email") return;
    const lineNo = index + 1;
    const email = normalizeEmail(rawEmail);
    if (!rawName) return errors.push(`Line ${lineNo}: name is missing`);
    if (!isValidEmail(email)) return errors.push(`Line ${lineNo}: "${rawEmail}" is not a valid email`);
    if (seen.has(email)) return errors.push(`Line ${lineNo}: ${email} appears more than once`);
    const role = rawRole.toLowerCase();
    if (role && role !== "hod" && role !== "admin") return errors.push(`Line ${lineNo}: role must be hod or admin`);
    seen.add(email);
    rows.push({ name: rawName, email, department: rawDept, role: role === "admin" ? "admin" : "hod" });
  });

  return { rows, errors };
}

/** Insert or update by email. Re-importing a person re-activates them. */
export async function upsertHods(rows: HodInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  await db
    .insert(hods)
    .values(rows.map((r) => ({ ...r, active: true })))
    .onConflictDoUpdate({
      target: hods.email,
      set: {
        name: sql`excluded.name`,
        department: sql`excluded.department`,
        role: sql`excluded.role`,
        active: true,
      },
    });
  return rows.length;
}
