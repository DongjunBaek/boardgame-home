# 개발 문서

이 앱을 만드는 데 필요한 계획·결정·설계·작업 방법을 모두 여기에 둔다.
사용법은 저장소 맨 위 [README.md](../README.md)에 있고, 화면을 고칠 때 지킬 규칙은 [CLAUDE.md](../CLAUDE.md)가 요약한다.

## 목차

| 폴더 | 무엇을 적나 | 문서 |
|---|---|---|
| [plan/](plan/) | 단계별 계획과 진행 상태 | [PLAN.md](plan/PLAN.md) (v1, 완료) · [v2-screen-renewal.md](plan/v2-screen-renewal.md) (화면 개편, 진행 중) |
| [design/](design/) | 화면 디자인 규칙과 앱 틀 | [ui-rules.md](design/ui-rules.md) · [layout.md](design/layout.md) |
| [features/](features/) | 메뉴 하나에 문서 하나: 상태·할 일·열린 질문 | [dashboard](features/dashboard.md) · [games](features/games.md) · [stores](features/stores.md) · [club-dues](features/club-dues.md) · [ledger](features/ledger.md) · [board](features/board.md) · [admin](features/admin.md) |
| [decisions/](decisions/) | 되돌리기 어려운 결정과 그 이유 | [0001 react-router](decisions/0001-react-router.md) · [0002 사이드바 메뉴](decisions/0002-sidebar-menu.md) |
| [dev/](dev/) | 설치·실행·테스트·작업 규칙 | [setup.md](dev/setup.md) · [testing.md](dev/testing.md) · [conventions.md](dev/conventions.md) |
| [questions.md](questions.md) | 아직 정하지 않아 사용자에게 물어볼 것 | |

옛 앱(Danseo)에서 넘겨받은 자료는 [handoff/HANDOFF.md](../handoff/HANDOFF.md)에 그대로 둔다 (읽기 전용).

## 문서 쓰는 규칙

- **어디에 적나**
  - 새 기능을 시작할 때는 `features/<메뉴>.md`의 상태와 할 일을 먼저 고친다.
  - 여러 메뉴에 걸친 큰 작업은 `plan/`에 계획 문서를 하나 만든다.
  - 기술 선택이나 범위를 바꾸는 결정은 `decisions/`에 번호를 붙여 남긴다. 예전 결정은 지우지 말고 "바뀜 → 00NN"을 적는다.
  - 화면 규칙이 바뀌면 `design/ui-rules.md`와 `CLAUDE.md`를 함께 고친다.
- **날짜:** `2026-10-09`처럼 절대 날짜로 적는다. "오늘", "지난주"는 쓰지 않는다.
- **상태 표기:** `준비 중` → `진행 중` → `완료`. 확인하지 못한 것은 "확인 못 함"이라고 적는다.
- **질문:** 바로 정해야 하는 것은 작업 중에 묻는다. 나중에 바꿔도 되는 것은 기본값으로 진행하고 [questions.md](questions.md)에 모아 한 번에 묻는다. 답을 받으면 해당 문서에 반영하고 질문은 "정함"으로 옮긴다.
- **코드와 함께 커밋:** 코드 변경과 그 문서 변경은 같은 커밋이나 바로 이어지는 커밋에 넣는다.
