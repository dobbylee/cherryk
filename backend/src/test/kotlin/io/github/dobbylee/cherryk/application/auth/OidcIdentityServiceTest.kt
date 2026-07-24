package io.github.dobbylee.cherryk.application.auth

import io.github.dobbylee.cherryk.domain.user.UserLevel
import org.junit.jupiter.api.Test
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

class OidcIdentityServiceTest {
    private val now = Instant.parse("2026-07-24T12:00:00Z")
    private val store = FakeOidcIdentityStore()
    private val service =
        OidcIdentityService(
            store = store,
            clock = Clock.fixed(now, ZoneOffset.UTC),
        )

    @Test
    fun `reuses an existing issuer and subject identity`() {
        val existing = store.addUser(email = "learner@example.com")
        store.identities[GOOGLE_ISSUER to "google-subject"] = existing.id

        val resolved = service.resolveOrCreate(profile(subject = "google-subject"))

        assertEquals(existing.id, resolved.id)
        assertEquals(0, store.createdUserCount)
        assertEquals(0, store.createdIdentityCount)
    }

    @Test
    fun `links a verified legacy Google subject to its existing application user`() {
        val existing = store.addUser(email = "learner@example.com")
        store.legacyGoogleUsers["legacy-google-subject"] = existing.id

        val resolved = service.resolveOrCreate(profile(subject = "legacy-google-subject"))

        assertEquals(existing.id, resolved.id)
        assertEquals(
            existing.id,
            store.identities[GOOGLE_ISSUER to "legacy-google-subject"],
        )
        assertEquals(0, store.createdUserCount)
        assertEquals(1, store.createdIdentityCount)
    }

    @Test
    fun `does not merge a new Google subject by matching email`() {
        val existing = store.addUser(email = "learner@example.com")

        val error =
            assertFailsWith<OidcIdentityException> {
                service.resolveOrCreate(profile(subject = "different-subject"))
            }

        assertEquals("identity_link_required", error.code)
        assertEquals(0, store.createdUserCount)
        assertTrue(store.identities.isEmpty())
        assertEquals(existing.id, store.findUserIdByEmail("learner@example.com"))
    }

    @Test
    fun `creates a new user only when no identity or email owner exists`() {
        val resolved =
            service.resolveOrCreate(
                profile(
                    subject = "new-subject",
                    email = " New.Learner@Example.com ",
                ),
            )

        assertEquals(1, store.createdUserCount)
        assertEquals(1, store.createdIdentityCount)
        assertEquals(resolved.id, store.identities[GOOGLE_ISSUER to "new-subject"])
        assertEquals(resolved.id, store.findUserIdByEmail("new.learner@example.com"))
    }

    @Test
    fun `rejects identities from an unexpected issuer`() {
        val error =
            assertFailsWith<OidcIdentityException> {
                service.resolveOrCreate(
                    profile(subject = "subject").copy(issuer = "https://issuer.example"),
                )
            }

        assertEquals("invalid_issuer", error.code)
        assertEquals(0, store.createdUserCount)
    }

    private fun profile(
        subject: String,
        email: String = "learner@example.com",
    ) = OidcIdentityProfile(
        issuer = GOOGLE_ISSUER,
        subject = subject,
        email = email,
        emailVerified = true,
        displayName = "Cherry",
        image = "https://example.com/profile.png",
    )
}

private class FakeOidcIdentityStore : OidcIdentityStore {
    val identities = mutableMapOf<Pair<String, String>, UUID>()
    val legacyGoogleUsers = mutableMapOf<String, UUID>()
    private val users = mutableMapOf<UUID, FakeUser>()
    var createdUserCount = 0
        private set
    var createdIdentityCount = 0
        private set

    fun addUser(email: String?): AuthenticatedUser {
        val user =
            FakeUser(
                id = UUID.randomUUID(),
                displayName = "Existing learner",
                email = email,
                level = UserLevel.BEGINNER,
            )
        users[user.id] = user
        return user.authenticated()
    }

    override fun findByIdentity(
        issuer: String,
        subject: String,
    ): AuthenticatedUser? = identities[issuer to subject]?.let(users::get)?.authenticated()

    override fun findLegacyGoogleUserId(subject: String): UUID? = legacyGoogleUsers[subject]

    override fun findUserById(userId: UUID): AuthenticatedUser? = users[userId]?.authenticated()

    override fun findUserIdByEmail(email: String): UUID? =
        users.values
            .firstOrNull { it.email?.equals(email, ignoreCase = true) == true }
            ?.id

    override fun createUser(
        profile: OidcIdentityProfile,
        now: Instant,
    ): AuthenticatedUser {
        createdUserCount += 1
        val user =
            FakeUser(
                id = UUID.randomUUID(),
                displayName = profile.displayName,
                email = profile.email,
                level = UserLevel.BEGINNER,
            )
        users[user.id] = user
        return user.authenticated()
    }

    override fun refreshUser(
        userId: UUID,
        profile: OidcIdentityProfile,
        now: Instant,
    ): AuthenticatedUser {
        val existing = checkNotNull(users[userId])
        val refreshed =
            existing.copy(
                displayName = profile.displayName ?: existing.displayName,
                email = profile.email ?: existing.email,
            )
        users[userId] = refreshed
        return refreshed.authenticated()
    }

    override fun createIdentity(
        issuer: String,
        subject: String,
        userId: UUID,
        now: Instant,
    ) {
        createdIdentityCount += 1
        assertNotEquals(null, users[userId])
        identities[issuer to subject] = userId
    }

    private data class FakeUser(
        val id: UUID,
        val displayName: String?,
        val email: String?,
        val level: UserLevel,
    ) {
        fun authenticated() = AuthenticatedUser(id, displayName, level)
    }
}
