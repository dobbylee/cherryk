# Historical Spring Session fixture

`security-context-bed7bf3.bin` is JDK serialization data generated from the
pre-refactor `bed7bf3ca53180215db14157e1b6ceae036efa7b` classes. The
retained `JavaExec` generator uses `ObjectOutputStream.writeObject` on a
`SecurityContextImpl` containing an `OAuth2AuthenticationToken` with a
`ProvisionedOidcUser`. Its source is retained in
`SessionFixtureGenerator.kt`. To reproduce from this phase-1 revision, before
moving any session classes, run:

```text
./backend/gradlew -p backend generateSessionFixture
cmp backend/build/session-fixtures/security-context-bed7bf3.bin backend/src/test/resources/session-fixtures/security-context-bed7bf3.bin
```

The principal uses only synthetic values: user ID `42`, display name
`Synthetic learner`, level `LOWER_INTERMEDIATE`, subject
`synthetic-session-subject`, and token `synthetic-token`. The generated file is
2,425 bytes; SHA-256:
`604a76f8c3b2a028be9a4f86179c4ddc7f95c0114fd7da3aac04154b1b4b9530`.

This committed byte stream must not be regenerated from future classes in
the compatibility test. The test places it directly into
`spring_session_attributes.attribute_bytes` and asks Spring Session to read it.
