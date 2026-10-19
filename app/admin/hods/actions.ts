"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { hods } from "@/lib/db/schema";
import { isValidEmail, normalizeEmail, parseHodCsv, upsertHods } from "@/lib/hods";

export type ActionResult = { ok: boolean; message: string } | null;

async function assertAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") throw new Error("Unauthorized");
  return user;
}

export async function addHod(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await assertAdmin();
  const name = String(form.get("name") ?? "").trim();
  const email = normalizeEmail(String(form.get("email") ?? ""));
  const department = String(form.get("department") ?? "").trim();
  const role = form.get("role") === "admin" ? "admin" : "hod";
  if (!name) return { ok: false, message: "Name is required." };
  if (!isValidEmail(email)) return { ok: false, message: "Enter a valid email." };
  await upsertHods([{ name, email, department, role }]);
  revalidatePath("/admin/hods");
  return { ok: true, message: `Saved ${name}. Adding an existing email updates that person.` };
}

export async function setHodActive(id: string, active: boolean): Promise<void> {
  const me = await assertAdmin();
  if (id === me.id && !active) throw new Error("You cannot deactivate yourself.");
  await db.update(hods).set({ active }).where(eq(hods.id, id));
  revalidatePath("/admin/hods");
}

export async function importHods(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await assertAdmin();
  const file = form.get("file");
  let text = String(form.get("csv") ?? "");
  if (file instanceof File && file.size > 0) {
    if (file.size > 1024 * 1024) return { ok: false, message: "CSV file must be under 1 MB." };
    text = await file.text();
  }
  if (!text.trim()) return { ok: false, message: "Choose a CSV file or paste CSV text." };
  const { rows, errors } = parseHodCsv(text);
  const saved = await upsertHods(rows);
  revalidatePath("/admin/hods");
  const summary = `Imported ${saved} HOD${saved === 1 ? "" : "s"}.`;
  return errors.length ? { ok: saved > 0, message: `${summary} Skipped: ${errors.join("; ")}` } : { ok: true, message: summary };
}
