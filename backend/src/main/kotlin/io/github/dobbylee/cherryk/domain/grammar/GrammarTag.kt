package io.github.dobbylee.cherryk.domain.grammar

enum class GrammarTag(
    val databaseValue: String,
) {
    PARTICLE_SUBJECT("particle_subject"),
    PARTICLE_TOPIC("particle_topic"),
    PARTICLE_OBJECT("particle_object"),
    PARTICLE_LOCATION("particle_location"),
    VERB_CONJUGATION("verb_conjugation"),
    HONORIFIC("honorific"),
    SPACING("spacing"),
    WORD_CHOICE("word_choice"),
    SENTENCE_ORDER("sentence_order"),
    MISSING_WORD("missing_word"),
    UNNATURAL("unnatural"),
    ;

    companion object {
        fun fromDatabase(value: String): GrammarTag =
            fromDatabaseOrNull(value)
                ?: throw IllegalArgumentException("Unknown grammar tag: $value")

        fun fromDatabaseOrNull(value: String): GrammarTag? =
            entries.firstOrNull { it.databaseValue == value }
    }
}
