CREATE TABLE "triage_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"issue_number" integer NOT NULL,
	"issue_url" text NOT NULL,
	"title" text NOT NULL,
	"decision" varchar(30) NOT NULL,
	"confidence" varchar(10) NOT NULL,
	"explanation" text NOT NULL,
	"reporter_email" varchar(255),
	"reporter_name" varchar(255),
	"pr_number" integer,
	"pr_url" text,
	"changed_files" jsonb,
	"cost_usd" numeric DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "triage_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone NOT NULL,
	"issues_processed" integer DEFAULT 0 NOT NULL,
	"auto_fixed" integer DEFAULT 0 NOT NULL,
	"needs_review" integer DEFAULT 0 NOT NULL,
	"not_a_bug" integer DEFAULT 0 NOT NULL,
	"errors" integer DEFAULT 0 NOT NULL,
	"total_cost_usd" numeric DEFAULT '0' NOT NULL,
	"dry_run" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "triage_issues" ADD CONSTRAINT "triage_issues_run_id_triage_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."triage_runs"("id") ON DELETE cascade ON UPDATE no action;