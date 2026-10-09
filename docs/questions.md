# 물어볼 질문

나중에 바꿔도 되는 것은 기본값으로 진행하고 여기에 모은다. 답을 받으면 해당 문서에 반영하고 아래 "정함"으로 옮긴다.

## 열린 질문

### 동아리 회비 관리 기획 (2026-10-09) → [features/club-dues.md](features/club-dues.md)

| # | 질문 | 지금 기본값 |
|---|---|---|
| 9 | 회비 구분 처음 값 | 정회원 · 준회원(금액 미정) · 면제. 금액은 회원 탭에서 적는다 |
| 10 | 현황표 기본 연도 | 올해 |
| 11 | 휴면·탈퇴 회원을 현황표에 보일지 | 그 해에 회원이었으면 흐리게 보임 |
| 12 | 회원 정렬 | 활동 → 휴면 → 탈퇴, 그 안에서 이름순 |

## 정함

| 날짜 | 질문 | 답 | 반영한 곳 |
|---|---|---|---|
| 2026-10-09 | 화면 이동 방식 | react-router | [decisions/0001](decisions/0001-react-router.md) |
| 2026-10-09 | 스토어 메뉴 | 사이드바에서 펼침 | [decisions/0002](decisions/0002-sidebar-menu.md) |
| 2026-10-09 | 첫 화면 | 대시보드 | [decisions/0002](decisions/0002-sidebar-menu.md) |
| 2026-10-09 | 사이트 이름 | 내 보드게임 | [design/layout.md](design/layout.md) |
| 2026-10-09 | 게임 추가·엑셀 단추 위치 | 목록 화면 제목줄 | [design/layout.md](design/layout.md) |
| 2026-10-09 | 상단바 오른쪽 | 비워 둠 | [design/layout.md](design/layout.md) |
| 2026-10-09 | 메뉴 이름 '내 보드게임 목록' | 그대로 | [design/layout.md](design/layout.md) |
| 2026-10-09 | 주소 이름 | 그대로 (`/`, `/games`, `/club/dues`, `/board`, `/admin`) | [design/layout.md](design/layout.md) |
| 2026-10-09 | 상단바 트랙 띠 | 더 얇고 흐리게 (2px, 불투명도 0.5) | [design/ui-rules.md](design/ui-rules.md) |
| 2026-10-09 | 로고·파비콘 | 지금 그대로 (주황 타일 주사위) | |
| 2026-10-09 | 스토어 메뉴 처음 상태 | 접어 둠 (펼침 상태는 기억) | [features/stores.md](features/stores.md) |
| 2026-10-09 | 휴대폰 폭 사이드바 | 지금처럼 위로 쌓음 | [design/layout.md](design/layout.md) |
| 2026-10-09 | 대시보드 내용 | 추후 기획. 그때까지 준비 중 | [features/dashboard.md](features/dashboard.md) |
| 2026-10-09 | **큰 방향: 혼자 vs 여러 사람** | **혼자 쓰는 장부 유지** (로그인·배포 없음) | [decisions/0002](decisions/0002-sidebar-menu.md) |
| 2026-10-09 | 회비 관리 첫 버전 범위 | 회원 명단 + 납부 현황표 | [features/club-dues.md](features/club-dues.md) |
| 2026-10-09 | 회비 주기 | 매달 | [features/club-dues.md](features/club-dues.md) |
| 2026-10-09 | 회비 금액 | 회원 구분별로 다름 | [features/club-dues.md](features/club-dues.md) |
| 2026-10-09 | 회원 규모·기존 기록 | 20명 이하, 기록 없음 | [features/club-dues.md](features/club-dues.md) |
