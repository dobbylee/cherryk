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
        }
    }
}

private object SharedPostgresContainer {
    val instance: PostgreSQLContainer =
        PostgreSQLContainer("postgres:18")
            .apply { start() }
}

private object DrizzleBaselinePostgresContainer {
    val instance: PostgreSQLContainer =
        PostgreSQLContainer("postgres:18")
            .apply { start() }
}
