package io.github.dobbylee.cherryk

import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.postgresql.PostgreSQLContainer

abstract class PostgreSqlIntegrationTest {
    companion object {
        @DynamicPropertySource
        @JvmStatic
        fun databaseProperties(registry: DynamicPropertyRegistry) {
            registry.add("spring.datasource.url", SharedPostgresContainer.instance::getJdbcUrl)
            registry.add("spring.datasource.username", SharedPostgresContainer.instance::getUsername)
            registry.add("spring.datasource.password", SharedPostgresContainer.instance::getPassword)
            registry.add("spring.security.oauth2.client.registration.google.client-id") {
                "test-google-client"
            }
            registry.add("spring.security.oauth2.client.registration.google.client-secret") {
                "test-google-secret"
            }
            registry.add("cherryk.security.secure-cookies") { "false" }
        }
    }
}

abstract class DrizzleBaselineIntegrationTest {
    companion object {
        @DynamicPropertySource
        @JvmStatic
        fun databaseProperties(registry: DynamicPropertyRegistry) {
            registry.add("spring.datasource.url", DrizzleBaselinePostgresContainer.instance::getJdbcUrl)
            registry.add(
                "spring.datasource.username",
                DrizzleBaselinePostgresContainer.instance::getUsername,
            )
            registry.add(
                "spring.datasource.password",
                DrizzleBaselinePostgresContainer.instance::getPassword,
            )
            registry.add("spring.flyway.target") { "1" }
            registry.add("spring.jpa.hibernate.ddl-auto") { "none" }
            registry.add("spring.security.oauth2.client.registration.google.client-id") {
                "test-google-client"
            }
            registry.add("spring.security.oauth2.client.registration.google.client-secret") {
                "test-google-secret"
            }
            registry.add("cherryk.security.secure-cookies") { "false" }
        }
    }
}

private object SharedPostgresContainer {
    val instance: PostgreSQLContainer =
        PostgreSQLContainer(TEST_POSTGRES_IMAGE)
            .apply { start() }
}

private object DrizzleBaselinePostgresContainer {
    val instance: PostgreSQLContainer =
        PostgreSQLContainer(TEST_POSTGRES_IMAGE)
            .apply { start() }
}

const val TEST_POSTGRES_IMAGE = "postgres:17"
