package io.github.dobbylee.cherryk.infrastructure.config

import io.github.dobbylee.cherryk.application.usage.DailyUsageLimitPolicy
import io.github.dobbylee.cherryk.application.usage.UsageFeature
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@ConfigurationProperties("cherryk.usage")
data class UsageMeteringProperties(
    val dailyLimits: Map<String, Long> = emptyMap(),
) {
    init {
        require(dailyLimits.values.all { it >= 0 }) {
            "Daily usage limits must be non-negative."
        }
    }
}

@Configuration
@EnableConfigurationProperties(UsageMeteringProperties::class)
class UsageMeteringConfiguration {
    @Bean
    fun dailyUsageLimitPolicy(properties: UsageMeteringProperties): DailyUsageLimitPolicy =
        DailyUsageLimitPolicy { feature: UsageFeature ->
            properties.dailyLimits[feature.databaseValue] ?: 0
        }
}
