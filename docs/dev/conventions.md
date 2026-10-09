# 작업 규칙

## git
- 커밋은 로컬에만 한다. push는 요청할 때만 한다.
- 커밋 메시지는 `종류: 한국어 설명` 형식이다. 예: `feat: 스토어 바로가기 사이드바`
  - 종류: `feat`(기능), `fix`(고침), `refactor`(동작 같음), `docs`(문서), `test`, `chore`
- 코드 변경과 그 문서 변경([docs/README.md](../README.md) 규칙)은 함께 커밋한다.

### 저장소를 공개로 바꾸기 전에: 마을 그림 빼기

저장소는 비공개라서 마을 그림(Sprout Lands 기본판으로 만든 것)을 커밋해 두었다 (2026-10-10 기준).
이 팩은 "팩 자체를 다시 나눠 주면 안 된다"는 조건이라, **공개로 바꾸거나 다른 사람을 초대하기 전에 아래를 먼저 한다.**
자세한 라이선스: [research/village-assets.md](../research/village-assets.md) 2절·9절

1. 팩에서 나온 그림을 저장소에서 뺀다 (`frontend/public/village/` 안)
   - `tilesets/*.png` (직접 만든 `collision.png`는 남겨도 된다)
   - `buildings/*.png`, `sprites/*.png`
   - `items/*.png` (직접 그린 `bookshelf.png`는 남겨도 된다)
   - `icons/chest-*.png` (직접 찍은 `coin.png`·`crystal.png`는 남겨도 된다)
2. 뺀 그림을 `.gitignore`에 넣고, `docs/dev/setup.md`에 "원본 팩을 받아 `assets-src/village/sprout-lands/`에 풀고 `python scripts/build_village_assets.py`를 실행한다"를 적는다.
3. **지난 커밋 기록에도 그림이 남아 있다.** 새 커밋으로 지우는 것만으로는 부족하다. 둘 중 하나를 한다.
   - 기록에서 지운다 (`git filter-repo` 등). 기록을 고쳐 쓰므로 강제 푸시가 필요하다.
   - 기록 없이 새 공개 저장소를 만들어 올린다.
4. 지도(`maps/*.tmj`)·타일셋 정보(`tilesets/*.tsj`)·`CREDITS.md`는 그림이 아니라서 남겨도 된다. 출처 표시는 계속 둔다.

## 데이터 (v1에서 이어짐)
- 데이터 변경은 미리보기 → 확인 → 백업 → 적용 순서로 한다.
- 게임 정보: 인원·시간·가격은 출처에서 확인한 값만 넣고, 모르면 비운다. 가격은 할인 전 정가다.
- 게임 ID는 바꾸지 않는다. 새로 정리한 제목은 사용자 확인을 받는다.
- 사용자가 작업 중에도 앱을 쓸 수 있다. 백업에서 되돌리기 전에 지금 데이터와 비교한다.
- 파이썬 한글 출력이 깨지면 `PYTHONIOENCODING=utf-8`을 붙인다.

## 화면
- 디자인 규칙은 [design/ui-rules.md](../design/ui-rules.md), 앱 틀과 주소는 [design/layout.md](../design/layout.md)에 있다.
- 새 메뉴는 `frontend/src/lib/nav.ts`에 정의하고, 화면 파일은 `frontend/src/pages/`에 둔다.
