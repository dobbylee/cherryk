DROP TABLE "invite_codes" CASCADE;--> statement-breakpoint
DROP TABLE "sessions" CASCADE;--> statement-breakpoint
DELETE FROM "users" WHERE "email" IS NULL;
