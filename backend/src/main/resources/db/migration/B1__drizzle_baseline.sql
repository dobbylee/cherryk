CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    display_name text,
    email text,
    email_verified boolean DEFAULT false NOT NULL,
    image text,
    level text DEFAULT 'beginner' NOT NULL,
    explanation_language text DEFAULT 'en' NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone,
    CONSTRAINT users_email_unique UNIQUE (email)
);

CREATE TABLE accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    account_id text NOT NULL,
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    access_token text,
    refresh_token text,
    id_token text,
    access_token_expires_at timestamp with time zone,
    refresh_token_expires_at timestamp with time zone,
    scope text,
    password text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT accounts_user_id_users_id_fk
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX accounts_provider_account_unique
    ON accounts (provider_id, account_id);

CREATE TABLE auth_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    ip_address text,
    user_agent text,
    user_id uuid NOT NULL,
    CONSTRAINT auth_sessions_token_unique UNIQUE (token),
    CONSTRAINT auth_sessions_user_id_users_id_fk
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE verifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE daily_usage (
    user_id uuid NOT NULL,
    usage_date date NOT NULL,
    correction_count integer DEFAULT 0 NOT NULL,
    ocr_count integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT daily_usage_user_id_usage_date_pk PRIMARY KEY (user_id, usage_date),
    CONSTRAINT daily_usage_user_id_users_id_fk
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE corrections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    input_type text NOT NULL,
    original_text text NOT NULL,
    corrected_text text NOT NULL,
    natural_text text,
    explanation_en text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT corrections_user_id_users_id_fk
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE correction_mistakes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    correction_id uuid NOT NULL,
    tag text NOT NULL,
    original_part text,
    corrected_part text,
    explanation_en text,
    severity text DEFAULT 'minor' NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT correction_mistakes_correction_id_corrections_id_fk
        FOREIGN KEY (correction_id) REFERENCES corrections (id) ON DELETE CASCADE
);

CREATE TABLE user_tag_stats (
    user_id uuid NOT NULL,
    tag text NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_tag_stats_user_id_tag_pk PRIMARY KEY (user_id, tag),
    CONSTRAINT user_tag_stats_user_id_users_id_fk
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE quiz_questions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    tag text NOT NULL,
    difficulty text NOT NULL,
    content_fingerprint text NOT NULL,
    status text NOT NULL,
    question_en text NOT NULL,
    sentence_ko text NOT NULL,
    answer_explanation_en text NOT NULL,
    source text DEFAULT 'ai_draft' NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quiz_questions_content_fingerprint_unique UNIQUE (content_fingerprint)
);

CREATE TABLE quiz_choices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    quiz_question_id uuid NOT NULL,
    choice_text text NOT NULL,
    is_correct boolean DEFAULT false NOT NULL,
    sort_order integer NOT NULL,
    CONSTRAINT quiz_choices_quiz_question_id_quiz_questions_id_fk
        FOREIGN KEY (quiz_question_id) REFERENCES quiz_questions (id) ON DELETE CASCADE
);

CREATE TABLE quiz_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    quiz_question_id uuid NOT NULL,
    selected_choice_id uuid,
    is_correct boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT quiz_attempts_user_id_users_id_fk
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT quiz_attempts_quiz_question_id_quiz_questions_id_fk
        FOREIGN KEY (quiz_question_id) REFERENCES quiz_questions (id) ON DELETE CASCADE,
    CONSTRAINT quiz_attempts_selected_choice_id_quiz_choices_id_fk
        FOREIGN KEY (selected_choice_id) REFERENCES quiz_choices (id)
);

CREATE INDEX quiz_attempts_user_question_created_idx
    ON quiz_attempts (user_id, quiz_question_id, created_at);
