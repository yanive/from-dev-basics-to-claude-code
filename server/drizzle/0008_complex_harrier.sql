ALTER TABLE "progress" ADD COLUMN "skipped" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "progress" ADD COLUMN "skipped_at" timestamp with time zone;