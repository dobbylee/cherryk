package io.github.dobbylee.cherryk

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.jdbc.core.simple.JdbcClient
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

@SpringBootTest
class BaselineMigrationTest(
    @Autowired private val jdbcClient: JdbcClient,
) : DrizzleBaselineIntegrationTest() {

    @Test
    fun `baseline recreates the final Drizzle schema`() {
        val applicationTables =
            jdbcClient
                .sql(
                    """
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                      AND table_type = 'BASE TABLE'
                      AND table_name <> 'flyway_schema_history'
                    ORDER BY table_name
                    """.trimIndent(),
                ).query(String::class.java)
                .list()

        assertEquals(
            listOf(
                "accounts",
                "auth_sessions",
                "correction_mistakes",
                "corrections",
                "daily_usage",
                "quiz_attempts",
                "quiz_choices",
                "quiz_questions",
                "user_tag_stats",
                "users",
                "verifications",
            ),
            applicationTables,
        )
        assertFalse(applicationTables.contains("invite_codes"))
        assertFalse(applicationTables.contains("sessions"))

        val successfulBaselineCount =
            jdbcClient
                .sql(
                    """
                    SELECT count(*)
                    FROM flyway_schema_history
                    WHERE success = true
                      AND script = 'B1__drizzle_baseline.sql'
                    """.trimIndent(),
                ).query(Int::class.java)
                .single()

        assertEquals(1, successfulBaselineCount)
        assertTrue(columnIsNullable("corrections", "natural_text"))
        assertTrue(columnIsNullable("quiz_attempts", "selected_choice_id"))
    }

    private fun columnIsNullable(
        table: String,
        column: String,
    ): Boolean =
        jdbcClient
            .sql(
                """
                SELECT is_nullable = 'YES'
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = :table
                  AND column_name = :column
                """.trimIndent(),
            ).param("table", table)
            .param("column", column)
            .query(Boolean::class.java)
            .single()
}
