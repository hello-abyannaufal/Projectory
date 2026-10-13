CREATE TABLE "group_unlocks" (
	"session_id" text NOT NULL,
	"group_id" uuid NOT NULL,
	CONSTRAINT "group_unlocks_session_id_group_id_pk" PRIMARY KEY("session_id","group_id")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"access_code" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "group_id" uuid;--> statement-breakpoint
-- Existing projects move into a default group.
INSERT INTO "groups" ("name") SELECT 'General' WHERE EXISTS (SELECT 1 FROM "projects");--> statement-breakpoint
UPDATE "projects" SET "group_id" = (SELECT "id" FROM "groups" LIMIT 1);--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "group_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "impersonated_by" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" text DEFAULT 'viewer' NOT NULL;--> statement-breakpoint
-- The account created before roles existed owns the instance.
UPDATE "user" SET "role" = 'super_user';--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "banned" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "ban_reason" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "ban_expires" timestamp;--> statement-breakpoint
ALTER TABLE "group_unlocks" ADD CONSTRAINT "group_unlocks_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_unlocks" ADD CONSTRAINT "group_unlocks_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_group_idx" ON "projects" USING btree ("group_id");