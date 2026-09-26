package io.github.dobbylee.cherryk.architecture.fixture.learning.api

import io.github.dobbylee.cherryk.learning.infrastructure.JdbcLearningTagHistory

class LearningApiWithImplementationDependency(
    val implementation: JdbcLearningTagHistory,
)
