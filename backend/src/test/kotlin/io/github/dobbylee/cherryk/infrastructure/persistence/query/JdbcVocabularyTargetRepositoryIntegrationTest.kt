package io.github.dobbylee.cherryk.infrastructure.persistence.query

import io.github.dobbylee.cherryk.PostgreSqlIntegrationTest
import io.github.dobbylee.cherryk.application.quiz.VocabularyTargetClaim
import io.github.dobbylee.cherryk.domain.user.UserLevel
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import java.util.concurrent.CyclicBarrier
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.test.assertEquals

@SpringBootTest
class JdbcVocabularyTargetRepositoryIntegrationTest(
    @Autowired private val repository: JdbcVocabularyTargetRepository,
) : PostgreSqlIntegrationTest() {
    @Test
    fun `concurrent claims select disjoint vocabulary targets`() {
        val executor = Executors.newFixedThreadPool(2)
        val barrier = CyclicBarrier(2)
        val claims = mutableListOf<VocabularyTargetClaim>()
        try {
            val first =
                executor.submit<VocabularyTargetClaim> {
                    barrier.await()
                    repository.claimUnusedTargets(UserLevel.LOWER_INTERMEDIATE, 10)
                }
            val second =
                executor.submit<VocabularyTargetClaim> {
                    barrier.await()
                    repository.claimUnusedTargets(UserLevel.LOWER_INTERMEDIATE, 10)
                }
            claims += first.get(10, TimeUnit.SECONDS)
            claims += second.get(10, TimeUnit.SECONDS)

            assertEquals(listOf(10, 10), claims.map { claim -> claim.words.size })
            assertEquals(20, claims.flatMap(VocabularyTargetClaim::words).toSet().size)
        } finally {
            executor.shutdownNow()
            claims.forEach { claim -> repository.releaseClaim(claim.reservationKey) }
        }
    }
}
