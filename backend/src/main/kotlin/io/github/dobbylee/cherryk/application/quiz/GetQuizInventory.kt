package io.github.dobbylee.cherryk.application.quiz

import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class GetQuizInventory(
    private val inventory: AdminQuizInventoryRepository,
) {
    @Transactional(readOnly = true)
    fun getTagCounts(): List<AdminQuizTagCount> {
        val countsByTag = inventory.countActiveQuizzesByTag().associateBy(AdminQuizTagCount::tag)
        return GrammarTag.entries.map { tag ->
            countsByTag[tag] ?: AdminQuizTagCount(tag, draftCount = 0, approvedCount = 0)
        }
    }
}
