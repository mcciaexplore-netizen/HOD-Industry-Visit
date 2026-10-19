import { boolean, doublePrecision, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const hodRole = pgEnum("hod_role", ["hod", "admin"]);
export const photoSource = pgEnum("photo_source", ["camera", "upload"]);

export const hods = pgTable("hods", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Always stored lower-cased and trimmed (see lib/hods.ts normalizeEmail).
  email: text("email").notNull().unique(),
  department: text("department").notNull().default(""),
  role: hodRole("role").notNull().default("hod"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const visits = pgTable(
  "visits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hodId: uuid("hod_id")
      .notNull()
      .references(() => hods.id),
    companyName: text("company_name").notNull(),
    accompanyingMembers: text("accompanying_members").array().notNull().default([]),
    purpose: text("purpose").notNull(),
    // Server time on submit, for audit.
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("visits_hod_created_idx").on(t.hodId, t.createdAt), index("visits_created_idx").on(t.createdAt)],
);

export const visitPhotos = pgTable(
  "visit_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    visitId: uuid("visit_id")
      .notNull()
      .references(() => visits.id, { onDelete: "cascade" }),
    blobUrl: text("blob_url").notNull(),
    source: photoSource("source").notNull(),
    // Device time for camera photos, user-selected time for uploads.
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    accuracyM: doublePrecision("accuracy_m"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("visit_photos_visit_idx").on(t.visitId)],
);

export type Hod = typeof hods.$inferSelect;
export type Visit = typeof visits.$inferSelect;
export type VisitPhoto = typeof visitPhotos.$inferSelect;
