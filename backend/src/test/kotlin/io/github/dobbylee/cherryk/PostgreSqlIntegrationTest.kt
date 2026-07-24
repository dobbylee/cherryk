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

private object SharedPostgresContainer {
    val instance: PostgreSQLContainer =
        PostgreSQLContainer("postgres:18")
            .apply { start() }
}
