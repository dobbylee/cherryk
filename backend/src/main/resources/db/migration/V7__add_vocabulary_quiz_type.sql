ALTER TABLE quiz_questions
    ADD COLUMN quiz_type text DEFAULT 'grammar' NOT NULL;

ALTER TABLE quiz_questions
    ALTER COLUMN sentence_ko DROP NOT NULL;

ALTER TABLE quiz_questions
    ADD CONSTRAINT quiz_questions_type_check
        CHECK (quiz_type IN ('grammar', 'vocabulary')),
    ADD CONSTRAINT quiz_questions_vocabulary_tag_check
        CHECK (quiz_type <> 'vocabulary' OR tag = 'word_choice'),
    ADD CONSTRAINT quiz_questions_content_shape_check
        CHECK (
            (quiz_type = 'grammar' AND sentence_ko IS NOT NULL)
            OR (quiz_type = 'vocabulary' AND sentence_ko IS NULL)
        );
