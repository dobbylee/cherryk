DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM accounts
        WHERE provider_id <> 'google'
    ) THEN
        RAISE EXCEPTION
            'Legacy accounts contain an unsupported provider';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM accounts account
        LEFT JOIN user_identities identity
          ON identity.issuer = 'https://accounts.google.com'
         AND identity.subject = account.account_id
        WHERE account.provider_id = 'google'
          AND (
            identity.id IS NULL
            OR identity.user_id <> account.user_id
          )
    ) THEN
        RAISE EXCEPTION
            'Legacy Google accounts are not fully represented by OIDC identities';
    END IF;
END
$$;

DROP TABLE auth_sessions;
DROP TABLE verifications;
DROP TABLE accounts;
