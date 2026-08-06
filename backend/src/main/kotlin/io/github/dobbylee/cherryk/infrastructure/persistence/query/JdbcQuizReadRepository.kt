package io.github.dobbylee.cherryk.infrastructure.persistence.query

import io.github.dobbylee.cherryk.application.quiz.QuizAttemptSummary
import io.github.dobbylee.cherryk.application.quiz.QuizReadRepository
import io.github.dobbylee.cherryk.application.quiz.RecommendedQuiz
import io.github.dobbylee.cherryk.application.quiz.RecommendedQuizChoice
import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.quiz.QuizType
import io.github.dobbylee.cherryk.domain.user.UserLevel
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate
import org.springframework.stereotype.Repository
import java.time.OffsetDateTime

@Repository
class JdbcQuizReadRepository(
    private val jdbcTemplate: NamedParameterJdbcTemplate,
) : QuizReadRepository {
    override fun findApprovedQuizzesByTags(
        quizType: QuizType,
        tags: Set<GrammarTag>,
    ): List<RecommendedQuiz> {
        val tagFilter =
            if (tags.isEmpty()) {
                ""
            } else {
                "AND q.tag IN (:tags)"
            }
        val parameters =
            MapSqlParameterSource().apply {
                if (tags.isNotEmpty()) {
                    addValue("tags", tags.map(GrammarTag::databaseValue))
                }
            }
        val rows =
            jdbcTemplate.query(
                """
                SELECT
                    q.id AS quiz_id,
                    q.quiz_type,
                    q.tag,
                    q.difficulty,
                    q.question_en,
                    q.sentence_ko,
                    c.id AS choice_id,
                    c.choice_text
                FROM quiz_questions q
                INNER JOIN quiz_choices c ON c.quiz_question_id = q.id
                WHERE q.status = 'approved'
                  AND q.quiz_type = :quizType
                $tagFilter
                ORDER BY q.created_at ASC, c.sort_order ASC
                """.trimIndent(),
                parameters.addValue("quizType", quizType.databaseValue),
            ) { resultSet, _ ->
                ApprovedQuizRow(
                    quizId = resultSet.getLong("quiz_id"),
                    quizType = QuizType.fromDatabase(resultSet.getString("quiz_type")),
                    tag = GrammarTag.fromDatabase(resultSet.getString("tag")),
                    difficulty = UserLevel.fromDatabase(resultSet.getString("difficulty")),
                    questionEn = resultSet.getString("question_en"),
                    sentenceKo = resultSet.getString("sentence_ko"),
                    choiceId = resultSet.getLong("choice_id"),
                    choiceText = resultSet.getString("choice_text"),
                )
            }

        return rows
            .groupBy(ApprovedQuizRow::quizId)
            .mapNotNull { (_, quizRows) ->
                val first = quizRows.first()
                val choices =
                    quizRows.map { row ->
                        RecommendedQuizChoice(id = row.choiceId, text = row.choiceText)
                    }
                if (choices.size != 4) {
                    return@mapNotNull null
                }
                RecommendedQuiz(
                    id = first.quizId,
                    quizType = first.quizType,
                    tag = first.tag,
                    difficulty = first.difficulty,
                    questionEn = first.questionEn,
                    sentenceKo = first.sentenceKo,
                    choices = choices,
                )
            }
    }

    override fun findAttemptSummaries(userId: Long): List<QuizAttemptSummary> =
        jdbcTemplate.query(
            """
            SELECT
                quiz_question_id,
                count(*)::int AS attempt_count,
                count(*) FILTER (WHERE is_correct)::int AS correct_count,
                (array_agg(is_correct ORDER BY created_at DESC, id DESC))[1] AS last_attempt_correct,
                max(created_at) AS last_attempted_at
            FROM quiz_attempts
            WHERE user_id = :userId
            GROUP BY quiz_question_id
            """.trimIndent(),
            mapOf("userId" to userId),
        ) { resultSet, _ ->
            QuizAttemptSummary(
                quizId = resultSet.getLong("quiz_question_id"),
                attemptCount = resultSet.getInt("attempt_count"),
                correctCount = resultSet.getInt("correct_count"),
                lastAttemptCorrect = resultSet.getBoolean("last_attempt_correct"),
                lastAttemptedAt =
                    resultSet
                        .getObject("last_attempted_at", OffsetDateTime::class.java)
                        .toInstant(),
            )
        }

    override fun findTopUserTags(userId: Long): List<GrammarTag> =
        jdbcTemplate
            .query(
                """
                SELECT tag
                FROM user_tag_stats
                WHERE user_id = :userId
                ORDER BY count DESC, last_seen_at DESC
                """.trimIndent(),
                mapOf("userId" to userId),
            ) { resultSet, _ ->
                resultSet.getString("tag")
            }.mapNotNull(GrammarTag::fromDatabaseOrNull)
}

private data class ApprovedQuizRow(
    val quizId: Long,
    val quizType: QuizType,
    val tag: GrammarTag,
    val difficulty: UserLevel,
    val questionEn: String,
    val sentenceKo: String?,
    val choiceId: Long,
    val choiceText: String,
)
