# 마을 그림·글꼴 출처

대시보드 마을(`/`)이 쓰는 그림과 글꼴이다. 받은 날: 2026-10-09.

## 그림: Sprout Lands (기본판)

Assets -From : Sprout Lands -By : Cup Nooble

- 원본: https://cupnooble.itch.io/sprout-lands-asset-pack
- 라이선스 (기본판 `read_me.txt` 요약)
  - 고쳐 써도 된다. 같은 스타일로 새 그림을 그려도 된다.
  - 비상업 프로젝트에만 쓴다. NFT와 AI 학습에는 쓸 수 없다.
  - 팩 자체를 다시 나눠 주거나 팔면 안 된다 (고쳤어도).
  - 출처 표시가 필요하다 (위 문구).
- **저장소를 공개로 바꾸기 전에 이 팩에서 나온 그림을 빼야 한다** (지난 커밋 기록까지). 할 일 목록: `docs/dev/conventions.md`의 "저장소를 공개로 바꾸기 전에"
- 이 폴더에서 고친 것
  - `buildings/*.png`: 나무집 지붕·벽·문·창 조각을 이어 붙여 만들었다. `shop`·`lab`은 지붕 색을 팩 팔레트 안의 다른 색으로 바꿨다.
  - `tilesets/collision.png`: 직접 만든 표시용 칸 (화면에는 그리지 않는다).
  - `icons/coin.png`, `icons/crystal.png`: 팩에 없어서 팩 팔레트 색으로 직접 찍었다.
  - `items/bookshelf.png`: 팩에 없어서 서랍장 색으로 직접 그렸다.
  - `sprites/player-*.png`(기본 빼고), `buildings/*-*.png`: 캐릭터·지붕 색을 팩 팔레트 안의 다른 색으로 바꾼 스킨이다.
  - `items/*.png`: `Basic Furniture.png`에서 가구를 하나씩 잘랐다.
  - `icons/chest-*.png`: `Chest.png`의 닫힌·열린 상자를 그림 있는 곳만 잘랐다.
  - `tilesets/crops.png` 3번째 줄: 2번째 줄 작물의 열매 색을 팩 팔레트의 파랑으로 바꿨다 (LV3 작물).
  - 나머지 PNG는 원본을 그대로 복사했다. 만드는 방법: `scripts/build_village_assets.py`

## 글꼴: Galmuri

- 원본: https://github.com/quiple/galmuri (npm `galmuri`)
- 라이선스: SIL Open Font License 1.1. 라이선스 문구는 `frontend/node_modules/galmuri/` 안에 함께 있다.
