DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM accounts account
        JOIN user_identities identity
          ON identity.issuer = 'https://accounts.google.com'
         AND identity.subject = account.account_id
        WHERE account.provider_id = 'google'
          AND identity.user_id <> account.user_id
    ) THEN
        RAISE EXCEPTION
            'Google OIDC identity conflicts with a legacy account user mapping';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM accounts
        WHERE provider_id = 'google'
          AND btrim(account_id) = ''
    ) THEN
        RAISE EXCEPTION
            'Legacy Google account has a blank provider account identifier';
    END IF;
END
$$;

INSERT INTO user_identities (issuer, subject, user_id, created_at)
SELECT
    'https://accounts.google.com',
    account.account_id,
    account.user_id,
    account.created_at
FROM accounts account
WHERE account.provider_id = 'google'
ON CONFLICT (issuer, subject) DO NOTHING;
