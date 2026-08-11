package io.github.dobbylee.cherryk.infrastructure.persistence.query

import io.github.dobbylee.cherryk.application.quiz.AdminQuizInventoryRepository
import io.github.dobbylee.cherryk.application.quiz.AdminQuizTagCount
import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate
import org.springframework.stereotype.Repository

@Repository
class JdbcAdminQuizInventoryRepository(
    private val jdbcTemplate: NamedParameterJdbcTemplate,
) : AdminQuizInventoryRepository {
    override fun countActiveQuizzesByTag(): List<AdminQuizTagCount> =
        jdbcTemplate.query(
            """
            SELECT
                tag,
                count(*) FILTER (WHERE status = 'draft') AS draft_count,
                count(*) FILTER (WHERE status = 'approved') AS approved_count
            FROM quiz_questions
            WHERE status IN ('draft', 'approved')
            GROUP BY tag
            ORDER BY tag
            """.trimIndent(),
            emptyMap<String, Any>(),
        ) { resultSet, _ ->
            AdminQuizTagCount(
                tag = GrammarTag.fromDatabase(resultSet.getString("tag")),
                draftCount = resultSet.getLong("draft_count"),
                approvedCount = resultSet.getLong("approved_count"),
            )
        }
}
