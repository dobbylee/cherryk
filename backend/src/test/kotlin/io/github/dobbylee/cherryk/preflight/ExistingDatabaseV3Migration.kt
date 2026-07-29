package io.github.dobbylee.cherryk.preflight

import org.flywaydb.core.Flyway
import org.flywaydb.core.api.MigrationVersion
import java.net.URI

private const val REQUIRED_V3_CONFIRMATION = "MIGRATE_VERIFIED_DATABASE_TO_V3"

fun main() {
    val result =
        ExistingDatabaseV3MigrationCommand(
            url = v3MigrationEnvironment("SCHEMA_PREFLIGHT_DATABASE_URL"),
            username = v3MigrationEnvironment("SCHEMA_PREFLIGHT_DATABASE_USERNAME"),
            password = v3MigrationEnvironment("SCHEMA_PREFLIGHT_DATABASE_PASSWORD"),
            confirmation = v3MigrationEnvironment("FLYWAY_V3_MIGRATION_CONFIRM"),
            expectedHost = v3MigrationEnvironment("FLYWAY_V3_MIGRATION_EXPECTED_HOST"),
        ).execute()

    println("Migration target ${result.migrationVersion} applied and validated.")
}

data class ExistingDatabaseV3MigrationCommand(
    val url: String,
    val username: String,
    val password: String,
    val confirmation: String,
    val expectedHost: String,
) {
    fun execute(): ExistingDatabaseV3MigrationResult {
        require(confirmation == REQUIRED_V3_CONFIRMATION) {
            "FLYWAY_V3_MIGRATION_CONFIRM must be $REQUIRED_V3_CONFIRMATION."
        }
        val actualHost =
            requireNotNull(URI(url.removePrefix("jdbc:")).host) {
                "SCHEMA_PREFLIGHT_DATABASE_URL must contain a host."
            }
        require(expectedHost == actualHost) {
            "FLYWAY_V3_MIGRATION_EXPECTED_HOST does not match the target database host."
        }

        return ExistingDatabaseV3Migration.run(url, username, password)
    }
}

object ExistingDatabaseV3Migration {
    fun run(
        url: String,
        username: String,
        password: String,
    ): ExistingDatabaseV3MigrationResult {
        require(url.startsWith("jdbc:postgresql://")) {
            "SCHEMA_PREFLIGHT_DATABASE_URL must be a PostgreSQL JDBC URL."
        }

        val flyway =
            Flyway
                .configure()
                .dataSource(url, username, password)
                .defaultSchema("public")
                .schemas("public")
                .target(MigrationVersion.fromVersion("3"))
                .load()
        val currentVersion = flyway.info().current()?.version?.version
        check(currentVersion == "2") {
            "Expected current Flyway version 2 before the staged V3 migration, got ${currentVersion ?: "none"}."
        }

        val migration = flyway.migrate()
        check(migration.targetSchemaVersion == "3") {
            "Expected Flyway to migrate to version 3, got ${migration.targetSchemaVersion}."
        }
        val validation = flyway.validateWithResult()
        check(validation.validationSuccessful) {
            validation.invalidMigrations.joinToString(
                prefix = "Flyway validation failed:\n- ",
                separator = "\n- ",
            )
        }

        return ExistingDatabaseV3MigrationResult(
            migrationVersion = migration.targetSchemaVersion,
        )
    }
}

data class ExistingDatabaseV3MigrationResult(
    val migrationVersion: String,
)

private fun v3MigrationEnvironment(name: String): String =
    requireNotNull(System.getenv(name)?.takeIf(String::isNotBlank)) {
        "$name is required."
    }
