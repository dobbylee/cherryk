ALTER TABLE quiz_questions
    ADD COLUMN supersedes_quiz_id uuid,
    ADD CONSTRAINT quiz_questions_supersedes_quiz_id_quiz_questions_id_fk
        FOREIGN KEY (supersedes_quiz_id) REFERENCES quiz_questions (id),
    ADD CONSTRAINT quiz_questions_not_self_superseding_check
        CHECK (supersedes_quiz_id IS NULL OR supersedes_quiz_id <> id),
    ADD CONSTRAINT quiz_questions_status_check
        CHECK (status IN ('draft', 'approved', 'retired')),
    ADD CONSTRAINT quiz_questions_difficulty_check
        CHECK (difficulty IN ('beginner', 'lower_intermediate', 'intermediate'));

ALTER TABLE quiz_choices
    ADD CONSTRAINT quiz_choices_question_sort_order_unique
        UNIQUE (quiz_question_id, sort_order),
    ADD CONSTRAINT quiz_choices_question_id_id_unique
        UNIQUE (quiz_question_id, id),
    ADD CONSTRAINT quiz_choices_sort_order_check
        CHECK (sort_order BETWEEN 0 AND 3);

CREATE UNIQUE INDEX quiz_choices_one_correct_per_question_unique
    ON quiz_choices (quiz_question_id)
    WHERE is_correct;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM quiz_questions question
        LEFT JOIN quiz_choices choice
          ON choice.quiz_question_id = question.id
        GROUP BY question.id
        HAVING count(choice.id) <> 4
            OR count(choice.id) FILTER (WHERE choice.is_correct) <> 1
    ) THEN
        RAISE EXCEPTION
            'Existing quizzes must have exactly four choices and one correct choice';
    END IF;
END
$$;

ALTER TABLE quiz_attempts
    DROP CONSTRAINT quiz_attempts_selected_choice_id_quiz_choices_id_fk,
    ALTER COLUMN selected_choice_id SET NOT NULL,
    ADD CONSTRAINT quiz_attempts_question_selected_choice_fk
        FOREIGN KEY (quiz_question_id, selected_choice_id)
        REFERENCES quiz_choices (quiz_question_id, id);

CREATE UNIQUE INDEX quiz_questions_active_fingerprint_unique
    ON quiz_questions (content_fingerprint)
    WHERE status = 'approved'
       OR (status = 'draft' AND supersedes_quiz_id IS NULL);

CREATE UNIQUE INDEX quiz_questions_revision_target_unique
    ON quiz_questions (supersedes_quiz_id)
    WHERE status = 'draft'
      AND supersedes_quiz_id IS NOT NULL;

ALTER TABLE quiz_questions
    DROP CONSTRAINT quiz_questions_content_fingerprint_unique;
