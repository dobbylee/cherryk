package io.github.dobbylee.cherryk.preflight

import org.flywaydb.core.Flyway
import org.flywaydb.core.api.MigrationVersion
import java.net.URI
import java.sql.DriverManager

private const val REQUIRED_CONFIRMATION = "BASELINE_DRIZZLE_AND_MIGRATE_TO_V2"

fun main() {
    val result =
        ExistingDatabaseAdoptionCommand(
            url = adoptionEnvironment("SCHEMA_PREFLIGHT_DATABASE_URL"),
            username = adoptionEnvironment("SCHEMA_PREFLIGHT_DATABASE_USERNAME"),
            password = adoptionEnvironment("SCHEMA_PREFLIGHT_DATABASE_PASSWORD"),
            confirmation = adoptionEnvironment("FLYWAY_ADOPTION_CONFIRM"),
            expectedHost = adoptionEnvironment("FLYWAY_ADOPTION_EXPECTED_HOST"),
        ).execute()

    println("Flyway baseline ${result.baselineVersion} created explicitly.")
    println("Migration target ${result.migrationVersion} applied and validated.")
}

data class ExistingDatabaseAdoptionCommand(
    val url: String,
    val username: String,
    val password: String,
    val confirmation: String,
    val expectedHost: String,
) {
    fun execute(): ExistingDatabaseAdoptionResult {
        require(confirmation == REQUIRED_CONFIRMATION) {
            "FLYWAY_ADOPTION_CONFIRM must be $REQUIRED_CONFIRMATION."
        }
        val actualHost =
            requireNotNull(URI(url.removePrefix("jdbc:")).host) {
                "SCHEMA_PREFLIGHT_DATABASE_URL must contain a host."
            }
        require(expectedHost == actualHost) {
            "FLYWAY_ADOPTION_EXPECTED_HOST does not match the target database host."
        }

        return ExistingDatabaseAdoption.run(url, username, password)
    }
}

object ExistingDatabaseAdoption {
    fun run(
        url: String,
        username: String,
        password: String,
    ): ExistingDatabaseAdoptionResult {
        require(url.startsWith("jdbc:postgresql://")) {
            "SCHEMA_PREFLIGHT_DATABASE_URL must be a PostgreSQL JDBC URL."
        }

        DriverManager.getConnection(url, username, password).use { connection ->
            val currentSchema =
                connection.createStatement().use { statement ->
                    statement.executeQuery("SELECT current_schema()").use { resultSet ->
                        resultSet.next()
                        resultSet.getString(1)
                    }
                }
            check(currentSchema == "public") {
                "The target connection must use the public schema."
            }
            connection.autoCommit = false
            connection.isReadOnly = true
            try {
                val report = SchemaPreflight.verify(connection)
                check(report.schemaErrors.isEmpty()) {
                    report.schemaErrors.joinToString(
                        prefix = "Schema does not match the frozen Drizzle baseline:\n- ",
                        separator = "\n- ",
                    )
                }
                check(report.quizReadiness.totalViolations == 0L) {
                    "Quiz lifecycle constraints are not ready: ${report.quizReadiness}"
                }
            } finally {
                connection.rollback()
            }
        }

        val flyway =
            Flyway
                .configure()
                .dataSource(url, username, password)
                .baselineVersion(MigrationVersion.fromVersion("1"))
                .baselineDescription("Drizzle schema baseline")
                .defaultSchema("public")
                .schemas("public")
                .target(MigrationVersion.fromVersion("2"))
                .load()
        check(flyway.info().current() == null) {
            "Flyway schema history already exists; refusing initial adoption."
        }

        val baseline = flyway.baseline()
        check(baseline.successfullyBaselined) {
            "Flyway did not create the explicit version 1 baseline."
        }
        val migration = flyway.migrate()
        check(migration.targetSchemaVersion == "2") {
            "Expected Flyway to migrate to version 2, got ${migration.targetSchemaVersion}."
        }
        val validation = flyway.validateWithResult()
        check(validation.validationSuccessful) {
            validation.invalidMigrations.joinToString(
                prefix = "Flyway validation failed:\n- ",
                separator = "\n- ",
            )
        }

        return ExistingDatabaseAdoptionResult(
            baselineVersion = baseline.baselineVersion,
            migrationVersion = migration.targetSchemaVersion,
        )
    }
}

data class ExistingDatabaseAdoptionResult(
    val baselineVersion: String,
    val migrationVersion: String,
)

private fun adoptionEnvironment(name: String): String =
    requireNotNull(System.getenv(name)?.takeIf(String::isNotBlank)) {
        "$name is required."
    }
