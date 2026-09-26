package io.github.dobbylee.cherryk

import com.tngtech.archunit.core.importer.ClassFileImporter
import com.tngtech.archunit.core.importer.ImportOption
import com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses
import io.github.dobbylee.cherryk.architecture.fixture.domain.DomainWithSpringDependency
import io.github.dobbylee.cherryk.architecture.fixture.learning.api.LearningApiWithImplementationDependency
import org.junit.jupiter.api.Test
import kotlin.test.assertTrue

class ArchitectureDependencyTest {
    private val productionClasses =
        ClassFileImporter()
            .withImportOption(ImportOption.DoNotIncludeTests())
            .importPackages("io.github.dobbylee.cherryk")

    @Test
    fun `architecture scan includes every existing layer`() {
        listOf("domain", "application", "infrastructure", "presentation", "platform", "learning").forEach { layer ->
            assertTrue(productionClasses.any { it.packageName.contains(".$layer.") })
        }
    }

    @Test
    fun `domain has no framework or outer layer dependencies`() {
        domainRule.check(productionClasses)
    }

    @Test
    fun `application does not depend on adapters or HTTP representation`() {
        noClasses()
            .that().resideInAPackage("..application..")
            .should().dependOnClassesThat()
            .resideInAnyPackage("..infrastructure..", "..presentation..", "..platform.web..")
            .check(productionClasses)
    }

    @Test
    fun `infrastructure does not depend on feature presentation`() {
        noClasses()
            .that().resideInAPackage("..infrastructure..")
            .should().dependOnClassesThat()
            .resideInAPackage("..presentation..")
            .check(productionClasses)
    }

    @Test
    fun `presentation does not depend on infrastructure adapters`() {
        noClasses()
            .that().resideInAPackage("..presentation..")
            .should().dependOnClassesThat()
            .resideInAPackage("..infrastructure..")
            .check(productionClasses)
    }

    @Test
    fun `shared HTTP support has no feature implementation dependencies`() {
        noClasses()
            .that().resideInAPackage("..platform..")
            .should().dependOnClassesThat()
            .resideInAnyPackage("..domain..", "..application..", "..infrastructure..", "..presentation..")
            .check(productionClasses)
    }

    @Test
    fun `domain rule rejects a deliberately invalid dependency`() {
        val invalidClasses = ClassFileImporter().importClasses(DomainWithSpringDependency::class.java)
        assertTrue(domainRule.evaluate(invalidClasses).hasViolation())
    }

    @Test
    fun `learning API has no implementation or framework dependency`() {
        learningApiRule.check(productionClasses)
    }

    @Test
    fun `learning API rule rejects an implementation dependency`() {
        val invalidClasses = ClassFileImporter().importClasses(LearningApiWithImplementationDependency::class.java)
        assertTrue(learningApiRule.evaluate(invalidClasses).hasViolation())
    }
}

private val domainRule =
    noClasses()
        .that().resideInAPackage("..domain..")
        .should().dependOnClassesThat()
        .resideInAnyPackage(
            "org.springframework..",
            "jakarta.persistence..",
            "jakarta.servlet..",
            "..application..",
            "..infrastructure..",
            "..presentation..",
            "..platform..",
        )

private val learningApiRule =
    noClasses()
        .that().resideInAPackage("..learning.api..")
        .should().dependOnClassesThat()
        .resideInAnyPackage(
            "..infrastructure..",
            "..application..",
            "..presentation..",
            "org.springframework..",
            "jakarta.persistence..",
        )
