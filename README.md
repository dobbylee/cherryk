<h1 align="center">
  <img src="public/brand/cherryk-mark-128.png" alt="CherryK 로고" width="128"><br>
  CherryK
</h1>

글쓰기 교정, 손글씨 OCR, 검수된 객관식 문제 풀이를 지원하는 한국어 학습 앱이다.

## 로컬 실행

```bash
pnpm install
cp .env.example .env.local
# .env.local에 Spring 백엔드 공급자와 OAuth 값을 설정한다.
docker compose --env-file .env.local --profile backend up --build -d
pnpm dev
```

로컬 Spring 백엔드와 Flyway가 관리하는 PostgreSQL 데이터베이스는 Docker에서
실행된다. Next.js는 프런트엔드만 담당하며 `/api/v1`과 `/api/auth` 요청을
설정된 `SPRING_BACKEND_ORIGIN`으로 프록시한다.

사용자는 Google 계정으로 가입하거나 로그인한다. 로컬 개발을 위해 Google
Cloud에 다음 승인된 리디렉션 URI를 설정한다.

```text
http://localhost:3000/api/auth/callback/google
```

`DAILY_CORRECTION_LIMIT`와 `DAILY_OCR_LIMIT`는 사용자별 UTC 기준 일일 AI 사용
한도를 제어한다. 기본값은 교정 20회와 사진 OCR 요청 10회이다.
`ADMIN_EMAILS`는 문제 검수 워크플로에 접근할 수 있는 Google 계정 이메일 주소를
쉼표로 구분한 허용 목록이다.

## 프로젝트 방향

- 프런트엔드는 Vercel의 Next.js로 유지하고, Kotlin/Spring이 모든 API, 인증, AI,
  영속성 동작을 담당한다.
- Neon Postgres를 단일 진실 공급원으로 유지한다.
- AI 문제 초안은 운영자가 승인해야 사용자에게 공개된다.
- 백엔드 마이그레이션과 데이터베이스 운영 명령은
  [`backend/README.md`](backend/README.md)에 정리되어 있다.

## 주요 명령

```bash
pnpm test
pnpm verify
pnpm test:unit
pnpm build
pnpm build:backend
```

`pnpm test`는 항상 백엔드 테스트를 다시 실행하므로 Testcontainers 통합 테스트를
위해 Docker가 필요하다. `pnpm verify`는 두 애플리케이션의 프로덕션 빌드와
Compose 설정 검증까지 추가로 실행한다.
