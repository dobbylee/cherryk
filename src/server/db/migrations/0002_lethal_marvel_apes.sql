DELETE FROM "quiz_questions" WHERE "status" = 'rejected';--> statement-breakpoint
ALTER TABLE "quiz_questions" DROP COLUMN "review_note";
