package io.github.dobbylee.cherryk

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class CherryKBackendApplication

fun main(args: Array<String>) {
    runApplication<CherryKBackendApplication>(*args)
}
