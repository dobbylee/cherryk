package io.github.dobbylee.cherryk.domain.user

enum class UserLevel(
    val databaseValue: String,
) {
    BEGINNER("beginner"),
    LOWER_INTERMEDIATE("lower_intermediate"),
    INTERMEDIATE("intermediate"),
    ;

    companion object {
        fun fromDatabase(value: String): UserLevel =
            entries.firstOrNull { it.databaseValue == value }
                ?: throw IllegalArgumentException("Unknown user level: $value")
    }
}
