# 스토어

주소: 없음 (사이드바에서 펼침) · 상태: **완료** (v1 뒤 추가, 2026-10-09 사이드바 메뉴로 옮김)

## 지금 있는 기능
- 스토어 바로가기 목록을 묶음별로 보여 준다. 이름을 누르면 새 탭에서 열린다.
- 숫자는 판매 링크가 그 스토어인 내 게임 수다. 누르면 목록 화면(`/games`)으로 가서 거른다.
- [편집]에서 추가·고치기·삭제를 한다.
- 처음에는 접혀 있다. 펼침 상태는 브라우저에 기억한다.

## 코드
- 화면: `frontend/src/components/SideNav.tsx`(펼침), `StoreSidebar.tsx`, `StoreDialog.tsx`
- 로직: `frontend/src/lib/stores.ts` (`storeKey`, `groupStores`). 같은 판단을 서버와 맞추려고 `shared/store_key_cases.json`을 함께 쓴다.
- 서버: `backend/app/stores.py`, 데이터 `data/stores.json`

## 열린 질문
- 별도 스토어 화면이 필요할지 (지금은 필요 없다고 정함, 2026-10-09)
