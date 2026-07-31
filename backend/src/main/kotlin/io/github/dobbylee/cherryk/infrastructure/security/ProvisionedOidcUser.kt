package io.github.dobbylee.cherryk.infrastructure.security

import io.github.dobbylee.cherryk.application.auth.ApplicationUserPrincipal
import io.github.dobbylee.cherryk.application.auth.AuthenticatedUser
import io.github.dobbylee.cherryk.domain.user.UserLevel
import org.springframework.security.oauth2.core.oidc.user.OidcUser
import java.io.Serializable

class ProvisionedOidcUser(
    applicationUser: AuthenticatedUser,
    private val delegate: OidcUser,
) : OidcUser by delegate,
    ApplicationUserPrincipal,
    Serializable {
    private val applicationUserId = applicationUser.id
    private val applicationUserDisplayName = applicationUser.displayName
    private val applicationUserLevel = applicationUser.level

    override val applicationUser: AuthenticatedUser
        get() =
            AuthenticatedUser(
                id = applicationUserId,
                displayName = applicationUserDisplayName,
                level = applicationUserLevel,
            )

    private companion object {
        const val serialVersionUID = 1L
    }
}
