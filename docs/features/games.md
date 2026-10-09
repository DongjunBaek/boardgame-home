# 내 보드게임 목록

주소: `/games` · 상태: **완료** (v1, 2026-10-09)

## 지금 있는 기능
- 표 보기: 제목 앞 표지(`GameThumb`), 정렬, 장르 탭
- 아래 입력창: 검색과 거르기 (제작사, N명 가능, N분 이하, 해봤음, 빈칸 있는 것만, 스토어)
- 표에서 바로 고치기: 제작사·인원·시간·정가·구매가격·개수·해봤음·별점
- 상세 창: 게임 정보·내 정보·구입 정보, 삭제
- 제목줄 오른쪽: 엑셀 내려받기 · 엑셀 올리기(미리보기 → 적용) · [게임 추가]

자세한 규칙과 데이터 모양은 [plan/PLAN.md](../plan/PLAN.md)에 있다.

## 코드
- 화면: `frontend/src/pages/GamesPage.tsx`, `components/GameTable.tsx`, `FilterBar.tsx`, `GenreTabs.tsx`, `GameDialog.tsx`, `ExcelImportDialog.tsx`
- 로직: `frontend/src/lib/games.ts`, `players.ts`, `gameForm.ts`
- 서버: `backend/app/games.py`, `excel.py`, `players.py`, `store.py`

## 나중에 (PLAN.md "나중에"에서 이어짐)
- 플레이 기록, 다음 게임 추천, 구매 희망 목록, 스마트스토어 가격 다시 확인
