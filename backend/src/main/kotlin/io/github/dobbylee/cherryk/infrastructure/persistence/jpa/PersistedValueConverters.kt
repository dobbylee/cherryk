package io.github.dobbylee.cherryk.infrastructure.persistence.jpa

import io.github.dobbylee.cherryk.domain.correction.CorrectionInputType
import io.github.dobbylee.cherryk.domain.correction.MistakeSeverity
import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.quiz.QuizSource
import io.github.dobbylee.cherryk.domain.quiz.QuizStatus
import io.github.dobbylee.cherryk.domain.user.UserLevel
import jakarta.persistence.AttributeConverter
import jakarta.persistence.Converter

@Converter
class UserLevelConverter : AttributeConverter<UserLevel, String> {
    override fun convertToDatabaseColumn(attribute: UserLevel): String = attribute.databaseValue

    override fun convertToEntityAttribute(dbData: String): UserLevel = UserLevel.fromDatabase(dbData)
}

@Converter
class GrammarTagConverter : AttributeConverter<GrammarTag, String> {
    override fun convertToDatabaseColumn(attribute: GrammarTag): String = attribute.databaseValue

    override fun convertToEntityAttribute(dbData: String): GrammarTag = GrammarTag.fromDatabase(dbData)
}

@Converter
class CorrectionInputTypeConverter : AttributeConverter<CorrectionInputType, String> {
    override fun convertToDatabaseColumn(attribute: CorrectionInputType): String = attribute.databaseValue

    override fun convertToEntityAttribute(dbData: String): CorrectionInputType =
        CorrectionInputType.fromDatabase(dbData)
}

@Converter
class MistakeSeverityConverter : AttributeConverter<MistakeSeverity, String> {
    override fun convertToDatabaseColumn(attribute: MistakeSeverity): String = attribute.databaseValue

    override fun convertToEntityAttribute(dbData: String): MistakeSeverity = MistakeSeverity.fromDatabase(dbData)
}

@Converter
class QuizStatusConverter : AttributeConverter<QuizStatus, String> {
    override fun convertToDatabaseColumn(attribute: QuizStatus): String = attribute.databaseValue

    override fun convertToEntityAttribute(dbData: String): QuizStatus = QuizStatus.fromDatabase(dbData)
}

@Converter
class QuizSourceConverter : AttributeConverter<QuizSource, String> {
    override fun convertToDatabaseColumn(attribute: QuizSource): String = attribute.databaseValue

    override fun convertToEntityAttribute(dbData: String): QuizSource = QuizSource.fromDatabase(dbData)
}
