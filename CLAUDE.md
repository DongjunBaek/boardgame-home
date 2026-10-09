# CLAUDE.md

개발 문서는 모두 `docs/`에 있다. 목차와 문서 쓰는 규칙은 `docs/README.md`에 있다.
- 계획: `docs/plan/` (v1 `PLAN.md`, 지금 `v2-screen-renewal.md`)
- 메뉴별 상태: `docs/features/`
- 결정 기록: `docs/decisions/`
- 설치·테스트·작업 규칙: `docs/dev/`
- 물어볼 질문: `docs/questions.md`

## 작업할 때

- 바로 정해야 하는 것은 작업 중에 묻는다. 나중에 바꿀 수 있는 것은 기본값으로 진행하고 `docs/questions.md`에 모아 한 번에 묻는다.
- 코드를 바꾸면 관련 문서(`features/`, `plan/`, 필요하면 `decisions/`)도 함께 고친다.
- 커밋은 로컬에만 한다. 형식은 `feat: 한국어 설명`이다 (`docs/dev/conventions.md`).

## 화면 디자인 (요약)

전체 규칙은 `docs/design/ui-rules.md`, 앱 틀과 주소는 `docs/design/layout.md`에 있다. 화면을 고치기 전에 둘 다 읽는다.

- **틀**
  - 맨 위 상단바: 로고 + 이름. 오른쪽은 기능 자리이고, 지금은 비어 있다.
  - 왼쪽 사이드바 메뉴: 대시보드 · 내 보드게임 목록 · 스토어(펼침) · 동아리 회비 관리 · 게시판 · 구분선 · 관리자 메뉴
  - 가운데: 주소별 화면
  - 목록 화면: 제목줄 → 장르 탭 → 표 → 아래 입력창(`.composer`). 토스트는 입력창 위에 뜬다.
  - 메뉴 정의는 `frontend/src/lib/nav.ts`에 둔다.
- **없는 기능을 흉내 내는 단추는 만들지 않는다.** 기능이 없는 메뉴는 '준비 중' 화면만 보여 준다.
- **색:** `styles.css` 맨 위 토큰만 쓴다.
  - 포인트 색은 흙빛 주황(`--accent`) 하나다.
  - 금지: 보라·파랑 그라데이션, 글자 그라데이션, 유리 카드, 네온
- **글꼴·아이콘:** Pretendard 14px, `lucide-react`. 글자 기호를 아이콘 대신 쓰지 않는다. 장식용 아이콘엔 `aria-hidden="true"`를 붙인다.
- **꾸밈은 두 곳뿐이다:** 제목 앞 표지(`GameThumb`), 상단바 아래 게임판 트랙 띠
- 움직임은 0.1~0.2초로 짧게 한다.
- **확인:** 고친 뒤 `npm --prefix frontend run build`를 돌리고, 밝은·어두운 화면을 둘 다 스크린샷으로 본다.
