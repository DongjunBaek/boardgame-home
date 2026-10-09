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

### 회계록 (2026-10-09) → [features/ledger.md](features/ledger.md)

| # | 질문 | 지금 기본값 |
|---|---|---|
| 13 | 메뉴 이름·위치·아이콘 | '회계록', 동아리 회비 관리 바로 아래, 책 아이콘 |
| 14 | 분류 처음 목록 | 회비 · 모임비 · 간식·식비 · 게임 구매 · 장소 대여 · 기타 |
| 15 | 표 정렬 | 최신 기록이 위 |
| 16 | 회비 입금의 날짜 | 회비 기록의 '낸 날' (없으면 그 달 1일). 지난 달 회비를 오늘 날짜로 적었다면 회계록에도 오늘로 나온다 |

### 대시보드 마을 (2026-10-09) → [plan/v3-village.md](plan/v3-village.md)

| # | 질문 | 지금 기본값 |
|---|---|---|
| 18 | 작물 레벨별 보상 | LV1 시간당 코인 10, LV2 25, LV3 60 (임시 숫자). 2단계에서 이 숫자로 만들었다 (`backend/app/village.py`의 `CROP_RATES`) |
| 19 | 크리스탈을 얻는 곳과 쓰는 곳 | 뽑기에서만 나오고, 뽑기에 쓴다 (코인 뽑기와 크리스탈 뽑기). 6단계에서 크리스탈 뽑기 = 스킨 뽑기로 만들었다 |
| 20 | 연구에 시간이 걸리는지 | 걸리지 않음. 재화를 내면 바로 레벨이 오른다 |
| 21 | 뽑기 한 번 값 | 코인 100. 4단계에서 이 값으로 만들었다 |
| 22 | 마을 글꼴 | 한글 픽셀 글꼴 Galmuri (마을 안에서만) |
| 23 | 책장의 책을 눌렀을 때 | 보기 전용 정보 창. 고치기는 '내 보드게임 목록'에서 한다. 5단계에서 이렇게 만들었다 |
| 24 | 휴대폰 화면 | 지도를 끌어서 옮기고 탭으로 이동한다. 키보드 이동은 컴퓨터에서만 |
| 25 | 마을 상태 초기화 단추 | 관리자 메뉴에 둔다 (나중에) |
| 26 | 기본판에 작물이 2종뿐. LV3 작물 그림 | 두 작물 중 하나의 색을 바꿔 만든다. 모자라면 프리미엄($3.99) 구매를 다시 묻는다 ([research/village-assets.md](research/village-assets.md) 9절). 3단계에서 분홍 열매를 파란 열매로 바꿔 만들었다 |
| 27 | (5단계까지 모두 기능이 생겨서 지금은 해당 없음) 아직 기능이 없는 건물(상점·연구소·집)을 지도에 그려 둘지. [decisions/0003](decisions/0003-dashboard-village.md)은 "아직 없는 건물은 그리지 않는다"인데, 1단계 계획은 "건물 누르면 패널 열기"다 | 네 곳 모두 그리고, 패널에는 설명과 "준비 중 · N단계에서 열립니다"만 보여 준다 (메뉴의 '준비 중' 화면과 같은 방식). 단추는 닫기 하나뿐이다 |
| 28 | 마을 패널 색 | 밝은·어두운 화면 모두 그림 팩 팔레트의 종이색 하나로 둔다 (게임 화면이라) |
| 29 | 작물 레벨 올리는 비용, 최고 레벨 | LV2 코인 300, LV3 코인 1,500. LV3이 최고 (임시 숫자, `backend/app/village.py`의 `CROP_COSTS`) |
| 30 | 뽑기 확률 | 가구 70% (27개 같은 확률) · 코인 50개 12% · 코인 150개 8% · 크리스탈 1개 7% · 크리스탈 3개 3% (`backend/app/village.py`의 `GACHA_TABLE`) |
| 31 | 크리스탈 뽑기 값과 스킨 | 크리스탈 3개, 아직 없는 스킨 6개(고양이 3 · 지붕 3) 중 같은 확률. 다 가지면 더 뽑을 수 없다 (`backend/app/village.py`의 `SKIN_GACHA_COST`) |

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
| 2026-10-09 | 회비 납부를 회계록에 보일지 | 자동으로 보여 줌 (낸 날 기준) | [features/ledger.md](features/ledger.md) |
| 2026-10-09 | 회계록 시작 잔액 | 0원 | [features/ledger.md](features/ledger.md) |
| 2026-10-09 | 보관 장소 | 한 곳 (합친 잔액) | [features/ledger.md](features/ledger.md) |
| 2026-10-09 | 대시보드 내용 (다시 정함) | 픽셀아트 마을 미니게임, 2단계 수준(타일 지도 + 움직이는 캐릭터) | [decisions/0003](decisions/0003-dashboard-village.md) |
| 2026-10-09 | 마을 건물 | 밭(자동 보상) · 집(집 안 지도, 꾸미기, 보드게임 책장) · 상점(뽑기) · 연구소(작물 레벨) | [plan/v3-village.md](plan/v3-village.md) |
| 2026-10-09 | 쌓이는 보상 한도 | 12시간 (나중에 24시간까지) | [plan/v3-village.md](plan/v3-village.md) |
| 2026-10-09 | 그림 구하기 (17번) | Sprout Lands 기본판(무료, 16px)으로 시작. 저장소는 비공개라 그림을 커밋함 | [research/village-assets.md](research/village-assets.md) |
| 2026-10-09 | 재화 | 코인 · 크리스탈 | [plan/v3-village.md](plan/v3-village.md) |
| 2026-10-09 | 뽑기 | 처음엔 단순 뽑기. 확률·중복은 나중에 기획 | [plan/v3-village.md](plan/v3-village.md) |
| 2026-10-09 | 꾸미기 | 칸에 맞춰 놓고 겹치기 가능. 뒤로 미룸 | [plan/v3-village.md](plan/v3-village.md) |
| 2026-10-09 | 책장 책 누르면 | 게임 정보가 보인다 | [plan/v3-village.md](plan/v3-village.md) |
| 2026-10-09 | 스킨 | 캐릭터와 건물 그림을 바꾼다 | [plan/v3-village.md](plan/v3-village.md) |
| 2026-10-09 | 움직임 | 키보드 또는 클릭한 곳으로 걸어감 | [plan/v3-village.md](plan/v3-village.md) |
| 2026-10-09 | 마을 저장 | 서버 | [plan/v3-village.md](plan/v3-village.md) |
