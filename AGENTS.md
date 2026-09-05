# 에이전트 운영 규칙

CherryK는 Next.js 프런트엔드와 Kotlin/Spring 백엔드로 구성된다.
계획하거나 수정하기 전에 이 파일과 `local/plan.md`를 읽는다. 이미 제공된 내용은
다시 읽지 않고, 아래에서 작업에 해당하는 문서와 절만 추가로 확인한다.

## 컨텍스트 라우팅

| 필요한 정보                           | 기준 위치                                        |
| ------------------------------------- | ------------------------------------------------ |
| 현재 작업과 다음 단계                 | `local/plan.md`와 연결된 활성 작업 문서          |
| 제품·아키텍처·보안·배포의 지속적 선택 | `agent-harness/decisions.md`의 관련 절           |
| 검증 선택과 하네스 변경 기준          | `agent-harness/workflow.md`                      |
| 구현 리뷰 기준                        | `agent-harness/prompts/implementation-review.md` |
| 로컬 실행·운영·복구 절차              | `backend/README.md`의 관련 절                    |
| 정확한 버전·명령·구현                 | 매니페스트, 코드, 테스트, `.github/workflows/`   |

`local/`은 Git에서 제외한다. 계획은 현재 상태를 안내하는 라우터로 유지하고, 완료된
롤아웃 로그·테스트 개수·커밋 목록은 작업 상세 문서에만 기록한다.

## 실행

- 시작과 재개 시 브랜치, `git status`, 기존 diff를 확인한다. 구현은 `preview`에서
  진행하며 기존 사용자 변경과 실행 중인 개발 서버를 보존한다.
- 확인 가능한 성공 기준을 정하고 가장 작은 일관된 단위를 구현한다. 모호함이
  정확성·제품 동작·개인정보·운영·롤아웃을 바꿀 때만 해소한다. 범위 밖의 리팩터링,
  재포맷, 미래 계층을 추가하지 않는다.
- 앱 명령에는 `pnpm`을 사용한다. 기본 테스트 게이트는 `pnpm test`, 로컬/CI 전체
  게이트는 `pnpm verify`이다. 변경별 추가 검증과 환경 차단 처리는
  `agent-harness/workflow.md`를 따른다.
- 커밋·푸시·배포는 사용자에게 허용된 범위 안에서 진행한다. 승인된 전달은
  `agent-harness/decisions.md`의 배포 경로와 `backend/README.md`의 운영 절차를 따른다.
  검증 생략을 위해 게이트나 보안 설정을 완화하지 않는다.

## 서비스 탐색

- 화면과 공통 UI는 `src/app`, 공개 계약과 공유 fixture는 `src/lib/contracts`,
  프런트엔드 API 도우미는 `src/lib/api`에서 확인한다.
- Spring 코드는 `backend/src/main/kotlin/io/github/dobbylee/cherryk` 아래의
  `presentation`, `application`, `domain`, `infrastructure`에서 확인한다.
  모듈 변경은 해당 기능의 호출 경로와 계약을 먼저 추적한다.
- 스키마는 `backend/src/main/resources/db/migration`, 운영은 `ops`와
  `.github/workflows`에서 확인한다. 경계와 불변 조건은 `decisions.md`가 소유한다.

## 필수 리뷰

모든 구현 또는 하네스 변경에 적용한다.

1. 관련 검증을 실행한다.
2. 프로젝트 `reviewer` 서브에이전트와 `agent-harness/prompts/implementation-review.md`를
   사용한다. 변경 파일 목록, 변경 목적, 관련 결정·활성 계획의 경로, 검증 결과와
   차단 요인을 전달한다. 전체 대화나 완료 이력을 복사하지 않는다.
3. 지적 사항을 수정하고 영향받은 검증과 리뷰를 반복하여 최종 출력이 정확히
   `No Findings`가 되도록 한다. 리뷰 이후 변경도 다시 리뷰한다.
4. 검증 명령·결과, 실행하지 못한 검증과 차단 요인, 최종 리뷰 결과를 보고한다.
   리뷰를 실행할 수 없다면 완료로 간주하지 않는다.

하네스 규칙의 추가·강화에는 `agent-harness/workflow.md`의 실패 근거와 최소 배치
기준을 적용한다.
