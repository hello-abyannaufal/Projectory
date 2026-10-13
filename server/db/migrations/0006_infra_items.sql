CREATE TYPE "public"."infra_type" AS ENUM('server', 'kubernetes', 'database', 'vpn', 'registry', 'other');--> statement-breakpoint
CREATE TABLE "infra_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"environment_id" uuid,
	"type" "infra_type" DEFAULT 'server' NOT NULL,
	"name" text NOT NULL,
	"host" text NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "infra_items" ADD CONSTRAINT "infra_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "infra_items" ADD CONSTRAINT "infra_items_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "infra_items_project_idx" ON "infra_items" USING btree ("project_id");