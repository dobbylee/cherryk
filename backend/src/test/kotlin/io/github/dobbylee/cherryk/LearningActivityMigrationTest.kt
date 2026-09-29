package io.github.dobbylee.cherryk

import org.flywaydb.core.Flyway
import org.flywaydb.core.api.MigrationVersion
import org.junit.jupiter.api.Test
import org.testcontainers.postgresql.PostgreSQLContainer
import java.sql.Connection
import java.time.OffsetDateTime
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import java.sql.SQLException

class LearningActivityMigrationTest {
    @Test
    fun `V10 backfills real source times preserves data and enforces activity identity`() {
        val postgres = PostgreSQLContainer(TEST_POSTGRES_IMAGE)
        postgres.start()
        try {
            migrate(postgres, "9")
            postgres.createConnection("").use { c ->
                c.createStatement().use { s ->
                    s.execute("INSERT INTO users (id, display_name) VALUES (1001, 'Migration fixture')")
                    s.execute("INSERT INTO corrections (id, user_id, input_type, original_text, corrected_text, created_at) VALUES (2001, 1001, 'text', '원문', '교정', '2026-09-28T23:30:00Z')")
                    s.execute("INSERT INTO quiz_questions (id, tag, difficulty, content_fingerprint, status, question_en, sentence_ko, answer_explanation_en) VALUES (3001, 'particle_object', 'beginner', 'rhythm-migration', 'approved', 'Choose.', '문장', 'Explanation.')")
                    (0..3).forEach { index ->
                        s.execute("INSERT INTO quiz_choices (id, quiz_question_id, choice_text, is_correct, sort_order) VALUES (${4001+index}, 3001, '선택 $index', ${index==0}, $index)")
                    }
                    s.execute("INSERT INTO quiz_attempts (id, user_id, quiz_question_id, selected_choice_id, is_correct, created_at) VALUES (5001, 1001, 3001, 4002, false, '2026-09-29T00:10:00Z')")
                }
            }
            migrate(postgres)
            migrate(postgres)
            postgres.createConnection("").use { c ->
                assertEquals(2, count(c, "learning_activities"))
                assertEquals(1, count(c, "corrections"))
                assertEquals(1, count(c, "quiz_attempts"))
                c.createStatement().use { s ->
                    s.executeQuery("SELECT occurred_at FROM learning_activities ORDER BY occurred_at").use { rs ->
                        rs.next(); assertEquals(OffsetDateTime.parse("2026-09-28T23:30:00Z").toInstant(), rs.getObject(1, OffsetDateTime::class.java).toInstant())
                        rs.next(); assertEquals(OffsetDateTime.parse("2026-09-29T00:10:00Z").toInstant(), rs.getObject(1, OffsetDateTime::class.java).toInstant())
                    }
                    assertFailsWith<SQLException> { s.execute("INSERT INTO learning_activities (user_id, occurred_at) VALUES (1001, now())") }
                    assertFailsWith<SQLException> { s.execute("INSERT INTO learning_activities (user_id, correction_id, occurred_at) VALUES (1001, 2001, now())") }
                    assertFailsWith<SQLException> { s.execute("INSERT INTO learning_activities (user_id, correction_id, quiz_attempt_id, occurred_at) VALUES (1001, 2001, 5001, now())") }
                    s.execute("DELETE FROM users WHERE id = 1001")
                    assertEquals(0, count(c, "learning_activities"))
                }
            }
        } finally { postgres.stop() }
    }

    private fun migrate(postgres: PostgreSQLContainer, target: String? = null) {
        val config = Flyway.configure().dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
        if (target != null) config.target(MigrationVersion.fromVersion(target))
        config.load().migrate()
    }

    private fun count(c: Connection, table: String): Int = c.createStatement().use { s ->
        s.executeQuery("SELECT count(*) FROM $table").use { rs -> rs.next(); rs.getInt(1) }
    }
}
