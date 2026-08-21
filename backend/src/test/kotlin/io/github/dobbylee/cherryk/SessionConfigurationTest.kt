package io.github.dobbylee.cherryk

import org.junit.jupiter.api.Test
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.session.jdbc.autoconfigure.JdbcSessionProperties
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.boot.test.context.runner.ApplicationContextRunner
import kotlin.test.assertEquals

class SessionConfigurationTest {
    private val contextRunner =
        ApplicationContextRunner()
            .withInitializer(ConfigDataApplicationContextInitializer())
            .withUserConfiguration(SessionPropertiesConfiguration::class.java)

    @Test
    fun `expired session cleanup runs hourly`() {
        contextRunner.run { context ->
            assertEquals(
                "0 0 * * * *",
                context.getBean(JdbcSessionProperties::class.java).cleanupCron,
            )
        }
    }

    @TestConfiguration(proxyBeanMethods = false)
    @EnableConfigurationProperties(JdbcSessionProperties::class)
    private class SessionPropertiesConfiguration
}
