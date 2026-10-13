CREATE TABLE "env_var_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deployment_id" uuid NOT NULL,
	"content" text NOT NULL,
	"action" text NOT NULL,
	"user_id" text,
	"user_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "env_var_versions" ADD CONSTRAINT "env_var_versions_deployment_id_deployments_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "env_var_versions" ADD CONSTRAINT "env_var_versions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "env_var_versions_deployment_idx" ON "env_var_versions" USING btree ("deployment_id","created_at");