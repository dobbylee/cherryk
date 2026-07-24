package io.github.dobbylee.cherryk.infrastructure.security

import io.github.dobbylee.cherryk.application.auth.OidcIdentityException
import io.github.dobbylee.cherryk.application.auth.OidcIdentityProfile
import io.github.dobbylee.cherryk.application.auth.OidcIdentityResolver
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService
import org.springframework.security.oauth2.core.OAuth2AuthenticationException
import org.springframework.security.oauth2.core.OAuth2Error
import org.springframework.security.oauth2.core.oidc.user.OidcUser
import org.springframework.stereotype.Component

@Component
class ProvisioningOidcUserService(
    private val identityResolver: OidcIdentityResolver,
) : OAuth2UserService<OidcUserRequest, OidcUser> {
    private val delegate = OidcUserService()

    override fun loadUser(userRequest: OidcUserRequest): OidcUser {
        val oidcUser = delegate.loadUser(userRequest)
        val profile =
            OidcIdentityProfile(
                issuer = oidcUser.claims["iss"]?.toString().orEmpty(),
                subject = oidcUser.claims["sub"]?.toString().orEmpty(),
                email = oidcUser.claims["email"] as? String,
                emailVerified = oidcUser.claims["email_verified"] == true,
                displayName = oidcUser.claims["name"] as? String,
                image = oidcUser.claims["picture"] as? String,
            )

        try {
            identityResolver.resolveOrCreate(profile)
        } catch (error: OidcIdentityException) {
            throw OAuth2AuthenticationException(
                OAuth2Error(error.code),
                error.message,
                error,
            )
        }

        return oidcUser
    }
}
