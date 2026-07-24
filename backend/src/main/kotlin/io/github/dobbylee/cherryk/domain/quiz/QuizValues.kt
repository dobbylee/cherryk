package io.github.dobbylee.cherryk.domain.quiz

enum class QuizStatus(
    val databaseValue: String,
) {
    DRAFT("draft"),
    APPROVED("approved"),
    RETIRED("retired"),
    ;

    companion object {
        fun fromDatabase(value: String): QuizStatus =
            entries.firstOrNull { it.databaseValue == value }
                ?: throw IllegalArgumentException("Unknown quiz status: $value")
    }
}

enum class QuizSource(
    val databaseValue: String,
) {
    AI_DRAFT("ai_draft"),
    SEED("seed"),
    ;

    companion object {
        fun fromDatabase(value: String): QuizSource =
            entries.firstOrNull { it.databaseValue == value }
                ?: throw IllegalArgumentException("Unknown quiz source: $value")
    }
}
