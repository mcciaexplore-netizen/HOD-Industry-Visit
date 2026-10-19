CREATE TYPE "public"."hod_role" AS ENUM('hod', 'admin');--> statement-breakpoint
CREATE TYPE "public"."photo_source" AS ENUM('camera', 'upload');--> statement-breakpoint
CREATE TABLE "hods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"department" text DEFAULT '' NOT NULL,
	"role" "hod_role" DEFAULT 'hod' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hods_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "visit_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visit_id" uuid NOT NULL,
	"blob_url" text NOT NULL,
	"source" "photo_source" NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"accuracy_m" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hod_id" uuid NOT NULL,
	"company_name" text NOT NULL,
	"accompanying_members" text[] DEFAULT '{}' NOT NULL,
	"purpose" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "visit_photos" ADD CONSTRAINT "visit_photos_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_hod_id_hods_id_fk" FOREIGN KEY ("hod_id") REFERENCES "public"."hods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "visit_photos_visit_idx" ON "visit_photos" USING btree ("visit_id");--> statement-breakpoint
CREATE INDEX "visits_hod_created_idx" ON "visits" USING btree ("hod_id","created_at");--> statement-breakpoint
CREATE INDEX "visits_created_idx" ON "visits" USING btree ("created_at");