CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD COLUMN "content_fingerprint" text;--> statement-breakpoint
WITH "normalized_choices" AS (
	SELECT
		"quiz_question_id",
		string_agg(
			regexp_replace(btrim("choice_text"), '[[:space:]]+', ' ', 'g') || chr(29) || CASE WHEN "is_correct" THEN '1' ELSE '0' END,
			chr(31)
			ORDER BY regexp_replace(btrim("choice_text"), '[[:space:]]+', ' ', 'g') COLLATE "C", "is_correct"
		) AS "choice_content"
	FROM "quiz_choices"
	GROUP BY "quiz_question_id"
), "fingerprints" AS (
	SELECT
		"quiz_questions"."id",
		encode(
			digest(
				concat_ws(
					chr(31),
					"quiz_questions"."tag",
					"quiz_questions"."difficulty",
					regexp_replace(btrim("quiz_questions"."sentence_ko"), '[[:space:]]+', ' ', 'g'),
					"normalized_choices"."choice_content"
				),
				'sha256'
			),
			'hex'
		) AS "content_fingerprint"
	FROM "quiz_questions"
	INNER JOIN "normalized_choices" ON "normalized_choices"."quiz_question_id" = "quiz_questions"."id"
)
UPDATE "quiz_questions"
SET "content_fingerprint" = "fingerprints"."content_fingerprint"
FROM "fingerprints"
WHERE "quiz_questions"."id" = "fingerprints"."id";--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "quiz_questions"
		WHERE "content_fingerprint" IS NULL
	) THEN
		RAISE EXCEPTION 'Quiz fingerprint migration found questions without choices.';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM "quiz_questions"
		GROUP BY "content_fingerprint"
		HAVING count(*) > 1
	) THEN
		RAISE EXCEPTION 'Quiz fingerprint migration found duplicate quiz content. Resolve duplicates before retrying.';
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "quiz_questions" ALTER COLUMN "content_fingerprint" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_content_fingerprint_unique" UNIQUE("content_fingerprint");
