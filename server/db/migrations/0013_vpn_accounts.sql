CREATE TABLE "environment_vpns" (
	"environment_id" uuid NOT NULL,
	"vpn_id" uuid NOT NULL,
	CONSTRAINT "environment_vpns_environment_id_vpn_id_pk" PRIMARY KEY("environment_id","vpn_id")
);
--> statement-breakpoint
CREATE TABLE "group_vpn_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vpn_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"username" text NOT NULL,
	"password" text DEFAULT '' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "environment_vpns" ADD CONSTRAINT "environment_vpns_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environment_vpns" ADD CONSTRAINT "environment_vpns_vpn_id_group_vpns_id_fk" FOREIGN KEY ("vpn_id") REFERENCES "public"."group_vpns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_vpn_accounts" ADD CONSTRAINT "group_vpn_accounts_vpn_id_group_vpns_id_fk" FOREIGN KEY ("vpn_id") REFERENCES "public"."group_vpns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_vpn_accounts" ADD CONSTRAINT "group_vpn_accounts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "group_vpn_accounts_vpn_user_idx" ON "group_vpn_accounts" USING btree ("vpn_id","user_id");