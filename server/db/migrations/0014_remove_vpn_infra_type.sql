DELETE FROM "infra_items" WHERE "type" = 'vpn';--> statement-breakpoint
ALTER TABLE "infra_items" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "infra_items" ALTER COLUMN "type" SET DEFAULT 'server'::text;--> statement-breakpoint
DROP TYPE "public"."infra_type";--> statement-breakpoint
CREATE TYPE "public"."infra_type" AS ENUM('server', 'kubernetes', 'database', 'registry', 'other');--> statement-breakpoint
ALTER TABLE "infra_items" ALTER COLUMN "type" SET DEFAULT 'server'::"public"."infra_type";--> statement-breakpoint
ALTER TABLE "infra_items" ALTER COLUMN "type" SET DATA TYPE "public"."infra_type" USING "type"::"public"."infra_type";