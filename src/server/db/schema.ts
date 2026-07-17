import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayName: text("display_name"),
  level: text("level").notNull().default("beginner"),
  explanationLanguage: text("explanation_language").notNull().default("en"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
});

export const inviteCodes = pgTable("invite_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  codeHash: text("code_hash").notNull().unique(),
  label: text("label"),
  maxUses: integer("max_uses").notNull().default(1),
  usedCount: integer("used_count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const corrections = pgTable("corrections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  inputType: text("input_type").notNull(),
  originalText: text("original_text").notNull(),
  correctedText: text("corrected_text").notNull(),
  naturalText: text("natural_text"),
  explanationEn: text("explanation_en"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const correctionMistakes = pgTable("correction_mistakes", {
  id: uuid("id").primaryKey().defaultRandom(),
  correctionId: uuid("correction_id")
    .notNull()
    .references(() => corrections.id, { onDelete: "cascade" }),
  tag: text("tag").notNull(),
  originalPart: text("original_part"),
  correctedPart: text("corrected_part"),
  explanationEn: text("explanation_en"),
  severity: text("severity").notNull().default("minor"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const userTagStats = pgTable(
  "user_tag_stats",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
    count: integer("count").notNull().default(0),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.tag] }),
  }),
);

export const quizQuestions = pgTable("quiz_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tag: text("tag").notNull(),
  difficulty: text("difficulty").notNull(),
  status: text("status").notNull(),
  questionEn: text("question_en").notNull(),
  sentenceKo: text("sentence_ko").notNull(),
  answerExplanationEn: text("answer_explanation_en").notNull(),
  source: text("source").notNull().default("ai_draft"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const quizChoices = pgTable("quiz_choices", {
  id: uuid("id").primaryKey().defaultRandom(),
  quizQuestionId: uuid("quiz_question_id")
    .notNull()
    .references(() => quizQuestions.id, { onDelete: "cascade" }),
  choiceText: text("choice_text").notNull(),
  isCorrect: boolean("is_correct").notNull().default(false),
  sortOrder: integer("sort_order").notNull(),
});

export const quizAttempts = pgTable("quiz_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  quizQuestionId: uuid("quiz_question_id")
    .notNull()
    .references(() => quizQuestions.id, { onDelete: "cascade" }),
  selectedChoiceId: uuid("selected_choice_id").references(() => quizChoices.id),
  isCorrect: boolean("is_correct").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
