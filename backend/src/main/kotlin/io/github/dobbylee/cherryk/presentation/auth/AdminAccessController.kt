package io.github.dobbylee.cherryk.presentation.auth

import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/admin")
class AdminAccessController {
    @GetMapping("/access")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun access() = Unit
}
