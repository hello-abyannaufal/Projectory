CREATE TABLE "env_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deployment_id" uuid NOT NULL,
	"path" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "env_files_deployment_path_unique" UNIQUE("deployment_id","path")
);
--> statement-breakpoint
ALTER TABLE "env_vars" DROP CONSTRAINT "env_vars_deployment_key_unique";--> statement-breakpoint
DROP INDEX "env_var_versions_deployment_idx";--> statement-breakpoint
ALTER TABLE "env_var_versions" ADD COLUMN "env_file_id" uuid;--> statement-breakpoint
ALTER TABLE "env_vars" ADD COLUMN "env_file_id" uuid;--> statement-breakpoint
-- Every existing deployment gets one ".env" file that takes over its variables and history.
INSERT INTO "env_files" ("deployment_id", "path") SELECT "id", '.env' FROM "deployments";--> statement-breakpoint
UPDATE "env_vars" SET "env_file_id" = (SELECT "id" FROM "env_files" WHERE "env_files"."deployment_id" = "env_vars"."deployment_id");--> statement-breakpoint
UPDATE "env_var_versions" SET "env_file_id" = (SELECT "id" FROM "env_files" WHERE "env_files"."deployment_id" = "env_var_versions"."deployment_id");--> statement-breakpoint
ALTER TABLE "env_var_versions" ALTER COLUMN "env_file_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "env_vars" ALTER COLUMN "env_file_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "env_files" ADD CONSTRAINT "env_files_deployment_id_deployments_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "env_var_versions" ADD CONSTRAINT "env_var_versions_env_file_id_env_files_id_fk" FOREIGN KEY ("env_file_id") REFERENCES "public"."env_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "env_vars" ADD CONSTRAINT "env_vars_env_file_id_env_files_id_fk" FOREIGN KEY ("env_file_id") REFERENCES "public"."env_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "env_var_versions_file_idx" ON "env_var_versions" USING btree ("env_file_id","created_at");--> statement-breakpoint
ALTER TABLE "env_vars" ADD CONSTRAINT "env_vars_file_key_unique" UNIQUE("env_file_id","key");