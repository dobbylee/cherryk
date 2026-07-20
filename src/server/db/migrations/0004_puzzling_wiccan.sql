ALTER TABLE "invite_codes" ADD COLUMN "user_id" uuid;--> statement-breakpoint
UPDATE "invite_codes" SET "max_uses" = GREATEST("used_count", 1);--> statement-breakpoint
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
