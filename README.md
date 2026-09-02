<h1 align="center">
  <img src="public/brand/cherryk-mark-128.png" alt="CherryK 로고" width="128"><br>
  CherryK
</h1>

한국어 글쓰기 교정, 손글씨 OCR, 검수된 객관식 연습을 하나의 흐름으로
제공하는 학습 서비스

학습자는 직접 쓴 문장이나 손글씨 초안을 바탕으로 필요한 부분만 교정받고, 이해한
내용을 문법·어휘 문제로 반복해 익힌다.

## 서비스 이용

### 글쓰기 교정

Google 계정으로 로그인한 뒤 한국어 문장을 쓰면,
필요한 변경과 쉬운 영어 설명을 함께 확인할 수 있다.

교정 전후의 텍스트와 변경 이유를
한 화면에서 검토하고 복사할 수 있다.

### 손글씨 OCR

손글씨 이미지를 올리면 CLOVA OCR이 편집 가능한 한국어 초안을 만든다. 초안을 직접
확인하고 수정한 뒤에만 교정을 요청하므로, 이미지 원본이나 의도하지 않은 텍스트가
교정 입력으로 바로 사용되지 않는다.

### 문제 연습

검수된 문법·어휘 객관식 문제를 풀고, 선택 직후 정답과 설명을 확인할 수 있다.

문제는 학습 이력과 선택한 문법 태그를 기준으로 추천되며 진행 상황을 기록한다.

## 주요 기능

- 필요한 변경만 제시하는 한국어 텍스트 교정과 영어 설명
- CLOVA OCR 기반 손글씨 초안 추출 및 편집 확인
- 승인된 문법·어휘 객관식 문제와 선택 직후 피드백
- 학습 이력과 태그 기반 문제 추천·진행 상황 기록
- Google OIDC 로그인과 PostgreSQL 기반 세션
- 운영자용 AI 문제 초안 생성, 수정, 승인·거절 워크플로
- 모바일 우선 반응형 화면, 개인정보처리방침·이용약관, Vercel Analytics

## 기술 구성

| 영역           | 기술                                                                      |
| -------------- | ------------------------------------------------------------------------- |
| Frontend       | Next.js 16, React 19, TypeScript 6, Tailwind CSS 4                        |
| Backend        | Kotlin 2.3, Spring Boot 4.1, Java 25                                      |
| Database       | PostgreSQL 18.6, Flyway, JPA, Spring Session JDBC                         |
| AI/OCR         | OpenAI Responses API, NAVER Cloud CLOVA OCR                               |
| Authentication | Google OIDC, Spring Security, CSRF-protected sessions                     |
| Infrastructure | Vercel, OCI, Docker Compose, Nginx                                        |
| Testing        | Vitest, JUnit 5, Testcontainers                                           |
| CI/CD          | GitHub Actions, immutable ARM64 images, exact-SHA deployment verification |

## 시스템 구성

```text
Browser
  |
  v
Vercel / Next.js
  ├── pages and static assets
  └── /api/v1/*, /api/auth/* ──> OCI Nginx
                                      |
                                      v
                                Kotlin / Spring
                                  ├── PostgreSQL 18.6
                                  ├── Google OIDC
                                  ├── CLOVA OCR
                                  └── OpenAI Responses API
```

프로덕션 PostgreSQL은 OCI의 내부 Docker 네트워크에서만 Spring 백엔드와 연결된다.
배포는 검증된 정확한 `main` 커밋의 ARM64 이미지로 진행하며, 서비스 상태와 공개 API를
확인한 뒤 완료한다.

## 프로젝트 구조

```text
cherryk/
├── src/app/                 # Next.js 화면과 same-origin API proxy
├── src/lib/                 # 프런트엔드 계약, API helper, 학습 UI 로직
├── backend/src/main/kotlin/ # Spring 도메인, 애플리케이션, HTTP 계층
├── backend/src/main/resources/db/migration/
│                            # Flyway migration history
├── public/brand/            # CherryK 브랜드 자산
├── ops/                     # OCI 배포, PostgreSQL backup, 운영 안전성 검사
├── agent-harness/           # 프로젝트 결정과 리뷰 기준
└── .github/workflows/       # CI와 exact-SHA backend 배포 workflow
```
