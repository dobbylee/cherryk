package io.github.dobbylee.cherryk.domain.correction

enum class CorrectionInputType(
    val databaseValue: String,
) {
    TEXT("text"),
    IMAGE_OCR("image_ocr"),
    ;

    companion object {
        fun fromDatabase(value: String): CorrectionInputType =
            entries.firstOrNull { it.databaseValue == value }
                ?: throw IllegalArgumentException("Unknown correction input type: $value")
    }
}

enum class MistakeSeverity(
    val databaseValue: String,
) {
    MINOR("minor"),
    MAJOR("major"),
    ;

    companion object {
        fun fromDatabase(value: String): MistakeSeverity =
            entries.firstOrNull { it.databaseValue == value }
                ?: throw IllegalArgumentException("Unknown mistake severity: $value")
    }
}
