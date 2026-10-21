/**
 * Seeds/updates HODs from a CSV (default data/hods.csv).
 *   npm run seed
 *   npm run seed -- path\to\hods.csv
 */
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

config({ path: ".env.local" });

async function main() {
  const { parseHodCsv, upsertHods } = await import("../lib/hods");
  const file = resolve(process.argv[2] ?? "data/hods.csv");
  const { rows, errors } = parseHodCsv(readFileSync(file, "utf8"));
  errors.forEach((e) => console.warn(`  skipped: ${e}`));
  const saved = await upsertHods(rows);
  console.log(`Seeded ${saved} HOD(s) from ${file}`);
  const admins = rows.filter((r) => r.role === "admin").map((r) => r.email);
  if (admins.length === 0) console.warn("  note: no admin rows in this CSV (set the 4th column to 'admin').");
}

// Exit explicitly: the postgres-js pool keeps the process alive otherwise.
main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
