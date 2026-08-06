package io.github.dobbylee.cherryk

import org.flywaydb.core.Flyway
import org.flywaydb.core.api.MigrationVersion
import org.junit.jupiter.api.Test
import org.testcontainers.postgresql.PostgreSQLContainer
import java.sql.Connection
import java.sql.Types
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class QuizLearningTargetMigrationTest {
    @Test
    fun `V8 backfills canonical deduplicated digests without changing quiz data`() {
        val postgres = PostgreSQLContainer(TEST_POSTGRES_IMAGE)
        postgres.start()
        try {
            migrate(postgres, "7")
            postgres.createConnection("").use(::insertExistingQuizzes)
            val before = postgres.createConnection("").use(::applicationRowCounts)

            migrate(postgres)

            postgres.createConnection("").use { connection ->
                assertEquals(before, applicationRowCounts(connection))
                assertEquals(7, queryInt(connection, "SELECT count(*) FROM quiz_learning_targets"))
                assertEquals(
                    1,
                    queryInt(
                        connection,
                        """
                        SELECT count(*)
                        FROM quiz_learning_targets
                        WHERE quiz_type = 'vocabulary'
                          AND tag = 'word_choice'
                          AND target_key = '도서관'
                        """.trimIndent(),
                    ),
                )
                assertEquals(
                    1,
                    queryInt(
                        connection,
                        """
                        SELECT count(*)
                        FROM quiz_learning_targets
                        WHERE quiz_type = 'vocabulary'
                          AND tag = 'word_choice'
                          AND target_key = '가'
                        """.trimIndent(),
                    ),
                )
                assertEquals(
                    1,
                    queryInt(
                        connection,
                        """
                        SELECT count(*)
                        FROM quiz_learning_targets
                        WHERE quiz_type = 'grammar'
                          AND tag = 'particle_object'
                          AND target_key = '원본 문장' || chr(31) || '정답'
                        """.trimIndent(),
                    ),
                )
                assertEquals(
                    0,
                    queryInt(
                        connection,
                        """
                        SELECT count(*)
                        FROM quiz_learning_targets
                        WHERE char_length(target_digest) <> 64
                           OR target_digest !~ '^[0-9a-f]{64}$'
                        """.trimIndent(),
                    ),
                )
                assertTrue(
                    queryInt(
                        connection,
                        """
                        SELECT char_length(target_key)
                        FROM quiz_learning_targets
                        WHERE quiz_question_id = 8009
                        """.trimIndent(),
                    ) > 10_000,
                )
                assertEquals(
                    1,
                    queryInt(
                        connection,
                        """
                        SELECT count(*)
                        FROM flyway_schema_history
                        WHERE success = true
                          AND version = '8'
                        """.trimIndent(),
                    ),
                )
            }
        } finally {
            postgres.stop()
        }
    }

    private fun insertExistingQuizzes(connection: Connection) {
        val fixtures =
            listOf(
                quiz(8001, "grammar-one", "particle_object", "같은 문장", "정답"),
                quiz(8002, "grammar-two", "particle_object", "같은 문장", "정답"),
                quiz(8003, "vocabulary-one", "word_choice", null, "도서관", vocabulary = true),
                quiz(8004, "vocabulary-two", "word_choice", null, "도서관", vocabulary = true),
                quiz(8005, "revision-original", "particle_object", "원본 문장", "정답", status = "approved"),
                quiz(8006, "revision-original", "particle_object", "원본 문장", "정답", supersedes = 8005),
                quiz(8007, "sentence-order", "sentence_order", "순서를 고르세요.", "저는 학교에 가요."),
                quiz(8008, "unnatural", "unnatural", "다음 중 자연스러운 문장을 고르세요.", "날씨가 좋아요."),
                quiz(8009, "long-target", "particle_object", "가".repeat(10_000), "정답"),
                quiz(8010, "composed-target", "word_choice", null, "가", vocabulary = true),
                quiz(8011, "decomposed-target", "word_choice", null, "가", vocabulary = true),
            )
        connection.autoCommit = false
        try {
            connection
                .createStatement()
                .use { statement ->
                    statement.execute("INSERT INTO users (id, display_name) VALUES (7001, 'Migration user')")
                }
            fixtures.forEach { fixture ->
                insertQuiz(connection, fixture)
                insertChoices(connection, fixture)
            }
            connection
                .createStatement()
                .use { statement ->
                    statement.execute(
                        """
                        INSERT INTO quiz_attempts (
                            id, user_id, quiz_question_id, selected_choice_id, is_correct
                        ) VALUES (
                            9901, 7001, 8005, 80050, true
                        )
                        """.trimIndent(),
                    )
                }
            connection.commit()
        } catch (exception: Throwable) {
            connection.rollback()
            throw exception
        } finally {
            connection.autoCommit = true
        }
    }

    private fun insertQuiz(
        connection: Connection,
        fixture: QuizFixture,
    ) {
        connection
            .prepareStatement(
                """
                INSERT INTO quiz_questions (
                    id, quiz_type, tag, difficulty, content_fingerprint,
                    supersedes_quiz_id, status, question_en, sentence_ko,
                    answer_explanation_en
                ) VALUES (
                    ?, ?, ?, 'beginner', ?, ?, ?, ?, ?, 'Migration explanation.'
                )
                """.trimIndent(),
            ).use { statement ->
                statement.setLong(1, fixture.id)
                statement.setString(2, if (fixture.vocabulary) "vocabulary" else "grammar")
                statement.setString(3, fixture.tag)
                statement.setString(4, fixture.fingerprint)
                if (fixture.supersedes == null) {
                    statement.setNull(5, Types.BIGINT)
                } else {
                    statement.setLong(5, fixture.supersedes)
                }
                statement.setString(6, fixture.status)
                statement.setString(7, if (fixture.vocabulary) "English definition." else "Choose.")
                statement.setString(8, fixture.sentenceKo)
                statement.executeUpdate()
            }
    }

    private fun insertChoices(
        connection: Connection,
        fixture: QuizFixture,
    ) {
        val choices = listOf(fixture.correctAnswer, "오답 하나", "오답 둘", "오답 셋")
        connection
            .prepareStatement(
                """
                INSERT INTO quiz_choices (
                    id, quiz_question_id, choice_text, is_correct, sort_order
                ) VALUES (?, ?, ?, ?, ?)
                """.trimIndent(),
            ).use { statement ->
                choices.forEachIndexed { index, choice ->
                    statement.setLong(1, fixture.id * 10 + index)
                    statement.setLong(2, fixture.id)
                    statement.setString(3, choice)
                    statement.setBoolean(4, index == 0)
                    statement.setInt(5, index)
                    statement.addBatch()
                }
                statement.executeBatch()
            }
    }

    private fun applicationRowCounts(connection: Connection): Map<String, Int> =
        listOf("quiz_questions", "quiz_choices", "quiz_attempts")
            .associateWith { table -> queryInt(connection, "SELECT count(*) FROM $table") }

    private fun queryInt(
        connection: Connection,
        sql: String,
    ): Int =
        connection
            .createStatement()
            .use { statement ->
                statement.executeQuery(sql).use { resultSet ->
                    resultSet.next()
                    resultSet.getInt(1)
                }
            }

    private fun migrate(
        postgres: PostgreSQLContainer,
        target: String? = null,
    ) {
        val configuration =
            Flyway
                .configure()
                .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
        target?.let { configuration.target(MigrationVersion.fromVersion(it)) }
        configuration.load().migrate()
    }

    private fun quiz(
        id: Long,
        fingerprint: String,
        tag: String,
        sentenceKo: String?,
        correctAnswer: String,
        vocabulary: Boolean = false,
        status: String = "draft",
        supersedes: Long? = null,
    ) = QuizFixture(
        id = id,
        fingerprint = fingerprint,
        tag = tag,
        sentenceKo = sentenceKo,
        correctAnswer = correctAnswer,
        vocabulary = vocabulary,
        status = status,
        supersedes = supersedes,
    )
}

private data class QuizFixture(
    val id: Long,
    val fingerprint: String,
    val tag: String,
    val sentenceKo: String?,
    val correctAnswer: String,
    val vocabulary: Boolean,
    val status: String,
    val supersedes: Long?,
)
