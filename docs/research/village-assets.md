# 마을 그림(에셋) 조사

작성: 2026-10-09 · 상태: **완료** (2026-10-09 A안으로 정함: Sprout Lands 기본판) · 관련: [plan/v3-village.md](../plan/v3-village.md) · [decisions/0003](../decisions/0003-dashboard-village.md) · [questions.md](../questions.md) 17번

대시보드 마을(구현 2단계: PixiJS + Tiled JSON)에 쓸 그림을 어디서 어떻게 구할지 조사했다.
아무것도 내려받거나 사지 않았다. 가격과 라이선스는 2026-10-09에 각 판매 페이지를 보고 적었다. 페이지에 없어서 확인하지 못한 것은 "확인 못 함"으로 적었다.

---

## 1. 에셋이란

**에셋(asset)**은 게임에 들어가는 재료 파일이다. 그림(PNG), 지도(JSON), 글꼴, 소리가 모두 에셋이다. 이 문서에서는 그림과 글꼴만 다룬다.

| 말 | 뜻 | 마을에서 쓰는 곳 |
|---|---|---|
| **타일(tile)** | 같은 크기의 정사각형 그림 한 칸. 바닥 타일을 바둑판처럼 깔아 지도를 만든다 | 풀밭, 길, 물, 울타리, 집 안 바닥과 벽 |
| **타일셋(tileset)** | 타일 여러 개를 PNG 한 장에 격자로 모아 둔 것. Tiled에서 이 그림을 불러와 칸을 골라 칠한다 | 마을 타일셋 한 장, 실내 타일셋 한 장 |
| **타일 크기** | 한 칸의 가로세로 픽셀. **16px**이 가장 흔하다(스타듀밸리도 16px). 32px은 더 자세하지만 그릴 것이 4배다 | 화면에서는 2배·3배로 키워서 보여 준다. 16px 타일을 3배로 키우면 48px 칸이 된다 |
| **스프라이트(sprite)** | 지도 위에 따로 움직이거나 놓이는 그림 하나. 캐릭터, 건물, 가구, 작물 | 캐릭터, 건물 4개, 작물 |
| **스프라이트시트(sprite sheet)** | 스프라이트 여러 장(또는 애니메이션의 모든 장면)을 PNG 한 장에 모은 것. 프로그램이 좌표로 한 칸씩 잘라 쓴다 | 캐릭터 한 명 = 시트 한 장 |
| **애니메이션 프레임** | 움직임을 이루는 장면 한 장. 걷기는 보통 **방향마다 4~6프레임**이다. 4방향 × 4프레임이면 16장이다 | 캐릭터 걷기, 물결, 연기 |
| **아틀라스(atlas)** | 시트와 "어느 그림이 어디에 있는지"를 적은 JSON 한 쌍. PixiJS가 바로 읽는다 | 캐릭터·아이콘 시트를 PixiJS에 넣을 때 |
| **오토타일(autotile)** | 풀밭과 길처럼 두 바닥이 만나는 가장자리를 자동으로 이어 주는 타일 묶음. Tiled에서는 "Terrain/Wang set"이라 부른다 | 길, 물가, 밭 가장자리 |

**그림 크기를 맞춰야 하는 이유:** 픽셀아트는 확대 배율이 정수일 때만 깔끔하다. 16px 팩과 32px 팩을 섞으면 한쪽을 2배로 키우거나 줄여야 한다. 그러면 한 화면 안에서 픽셀 굵기가 달라져 바로 눈에 띈다.

---

## 2. 라이선스 차이

| 종류 | 뜻 | 지킬 것 |
|---|---|---|
| **CC0** (퍼블릭 도메인) | 저작권을 포기했다. 무엇이든 해도 된다 | 없음. 출처는 적어 주면 좋다 |
| **CC-BY 4.0** (출처 표시) | 자유롭게 써도 되지만 **누가 만들었는지 적어야** 한다 | 만든 사람 이름, 원본 링크, 라이선스 이름, 고쳤으면 고쳤다고 적기 |
| **CC-BY-SA 3.0 / GPL** (출처 표시 + 같은 조건) | 출처 표시에 더해 **고친 그림을 나눠 줄 때 같은 라이선스로** 나눠야 한다 | 위 + 고친 그림을 공개하면 같은 라이선스로 |
| **판매자 자체 라이선스** (itch.io 유료 팩 대부분) | 판매자가 직접 쓴 조건. 보통 "게임에 넣는 것은 되지만 **그림 파일 자체를 다시 나눠 주면 안 된다**" | 페이지의 라이선스 문구를 그대로 따른다. 팩마다 다르다 |
| **무료판은 비상업만** | Sprout Lands처럼 무료판은 비상업, 유료판은 상업 허용인 경우 | 돈을 벌지 않으면 무료판으로 충분하다 |

### 혼자 쓰는 이 앱에서 지킬 것

이 앱은 배포하지 않고 혼자 쓴다([decisions/0002](../decisions/0002-sidebar-menu.md)). 그래서 '상업 사용'과 '게임 안 출처 표시'는 대부분 문제가 되지 않는다. 그래도 아래 셋은 지킨다.

1. **저장소에 올리는 것도 재배포가 될 수 있다.** 이 저장소에는 GitHub 원격(`origin`)이 있다. 저장소가 공개 상태라면 유료 팩의 PNG를 커밋해서 올리는 것만으로 "재배포 금지"를 어기게 된다. 공개 여부는 확인 못 함.
   → **2026-10-09 확인: 저장소는 비공개다.** 혼자만 보는 비공개 저장소에 올리는 것은 남에게 나눠 주는 것이 아니므로 그림을 커밋해도 된다.
   → **저장소를 공개로 바꾸거나 다른 사람을 초대하기 전에는** 재배포 금지 팩의 그림을 저장소에서(기록까지) 빼야 한다. CC0와 CC-BY 그림은 그대로 둬도 된다(CC-BY는 출처 파일을 함께 둔다). 뺄 파일과 순서: [dev/conventions.md](../dev/conventions.md) "저장소를 공개로 바꾸기 전에"
2. **출처 파일을 남긴다.** CC-BY는 의무이고, 나머지도 나중에 어디서 받았는지 알 수 있게 적는다(6절).
3. **AI 금지 조항을 확인한다.** 몇몇 판매자는 "AI 학습 금지"를 넘어 **"AI로 만든 그림·글·코드와 함께 쓰는 것 금지"**까지 적는다. 이 앱은 AI(Claude Code)와 함께 만들고 있으므로, 그런 팩은 혼자 쓰더라도 라이선스와 맞지 않는다(Mana Seed가 그렇다, 4절).

---

## 3. 어디서 구하나

| 곳 | 주소 | 특징 |
|---|---|---|
| **Kenney** | https://kenney.nl/assets | 전부 **CC0**. 무료. 스타일이 깔끔하고 단순하다. 16px 마을 팩이 있지만 걷는 캐릭터와 작물 단계는 약하다 |
| **itch.io** | https://itch.io/game-assets/tag-top-down/tag-pixel-art | 개인 작가들의 장터. 무료·"원하는 만큼 내기"·유료가 섞여 있다. **농장·아늑한 마을 팩은 대부분 여기에 있다.** 라이선스는 팩마다 다르다 |
| **OpenGameArt** | https://opengameart.org | 자유 라이선스(CC0·CC-BY·CC-BY-SA·GPL) 그림 모음. 무료. 작가가 많아 스타일이 제각각이고, **LPC**처럼 규칙을 맞춰 그린 묶음은 예외다 |
| **CraftPix, GameDev Market** | https://craftpix.net · https://www.gamedevmarket.net | 유료 장터. 판타지 팩이 많다. 이번 조사에서는 자세히 보지 않았다 |

**무료로 시작할 곳:** Kenney, itch.io의 무료·"원하는 만큼 내기" 팩, OpenGameArt의 LPC.
**유료로 살 곳:** itch.io(값이 싸다, 보통 $4~$30), CraftPix.

---

## 4. 추천 후보 비교

"원하는 만큼 내기"는 0원으로도 받을 수 있다는 뜻이다.

| 이름 | 가격 | 라이선스 | 타일 | 마을 | 실내 | 캐릭터 4방향 걷기 | 작물 단계 | 가구 | 스킨(옷 갈아입기) | 아이콘 |
|---|---|---|---|---|---|---|---|---|---|---|
| **[Sprout Lands](https://cupnooble.itch.io/sprout-lands-asset-pack)** (Cup Nooble) | 기본 무료 / 프리미엄 $3.99 이상 | 기본: **비상업만**, 프리미엄: 상업 가능. 둘 다 재배포 금지, **출처 표시 필수**(9절) | 16px | 있음(풀밭·언덕·물·밭흙·울타리·다리·나무) | **있음** (나무집 벽·지붕·문 타일, 가구) | **있음** (기본판도 4방향 × 4프레임) | **있음** (기본판 2종 × 4단계) | **있음** (침대·의자·탁자·서랍·시계·화분·등·러그·그림) | 없음 (캐릭터 하나) | 도구·재료·수확물 아이콘 |
| **[Sunnyside World](https://danieldiggle.itch.io/sunnyside)** (Daniel Diggle) | 원하는 만큼 내기 | 상업 가능, 출처 선택, 재배포·AI 학습 금지 | 16px | 있음(건물 포함) | "Interiors" 있음, 자세히는 확인 못 함 | **좌우만**. 4방향은 베타 다운로드 | **있음** (작물 11종 × 5단계) | 확인 못 함 | 사람·고블린 정도 | UI 아이콘 있음 |
| **[Ninja Adventure](https://pixel-boy.itch.io/ninja-adventure-asset-pack)** (Pixel-boy & AAA) | 원하는 만큼 내기 | **CC0** | 16px | 있음 | 있음(실내 요소) | 있음 (캐릭터 50명 이상) | 확인 못 함 (페이지에 없음) | 적다고 작가가 직접 적음 | **캐릭터 50명 이상 = 스킨으로 쓰기 좋음** | 아이템 60개 이상, 글꼴 2개(영문) |
| **[LPC](https://lpc.opengameart.org/)** (OpenGameArt 공동 작업) | 무료 | **CC-BY-SA 3.0 + GPL 3** (작가별 출처 표시 필수) | **32px** | 있음 | 있음 | 있음 (캐릭터 생성기로 옷·머리 조합) | 있음 (LPC 작물 묶음) | 있음 | **가장 많음** | 있음 |
| **[Mana Seed](https://seliel-the-shaper.itch.io/)** (Seliel the Shaper) | 낱개 유료. 농부 $29.99 + 작물 $9.99 + 집 $17.99 + 가구 $16.99 + 마을 소품 $7.99 = 약 **$83**, 묶음 $99.99 | 자체 라이선스: 상업 가능, 출처 선택, 재배포 금지, **AI로 만든 그림·글·코드와 함께 쓰기 금지** | 16px (캐릭터는 64×64 칸 안의 32px 높이) | 소품·나무·울타리 있음 | **있음** (초가집·통나무집 등) | **있음** (150가지 이상 동작) | **있음** (6단계) | **있음** (250개 이상) + **도서관 타일셋** | **있음** (옷·머리 18종·모자 7종) | 16px 아이콘 있음 |

Kenney의 [Tiny Town](https://kenney.nl/assets/tiny-town)과 [Roguelike RPG Pack](https://kenney.nl/assets/roguelike-rpg-pack)(둘 다 CC0, 16px)도 봤다. 마을·가구 타일은 있지만 걷는 애니메이션과 작물 단계가 없어 표에서 뺐다. 빈자리를 메우는 용도로는 쓸 만하다.
LimeZu의 [Serene Village revamped](https://limezu.itch.io/serenevillagerevamped)(CC-BY 4.0, 16px, 집 24채)도 봤다. 캐릭터는 현대풍 유료 팩(Modern Interiors)에서 가져오는 구조라서 판타지 마을과 맞지 않아 뺐다.

### 우리 목록 중 빠진 것

| 필요한 것 | 어느 팩에도 없거나 약한 것 | 메울 방법 |
|---|---|---|
| **뽑기 상점, 연구소** 건물 | 어느 팩에도 '뽑기 상점'·'연구소'라는 건물은 없다 | 비슷한 집에 간판·소품(물약병, 상자)을 올려서 만든다. Mana Seed·Sprout Lands의 집 겉모습을 바탕으로 쓴다 |
| **건물 스킨** | 같은 건물의 다른 그림을 주는 팩은 드물다 (Mana Seed 일부 팩만 색 바꾼 판 제공) | 처음에는 **색 바꾸기(팔레트 교체)**로 만든다. 같은 그림의 색만 바꿔도 스킨이 된다 |
| **책장에 꽂힌 책 169권** | 책장 그림은 있어도 책 한 권 한 권을 다루는 팩은 없다 (Mana Seed 도서관 타일셋이 가장 가깝다) | **책장 틀만 그림을 쓰고, 책 등은 코드로 그린다.** 계획대로 장르 색(보드 이끼색, 머더 와인색)의 가는 사각형 2~3px이면 픽셀아트와 어울린다 |
| **코인·크리스탈 아이콘** | 대부분 팩에 동전은 있다. 크리스탈은 팩마다 다르다 | 16px 아이콘 두 개는 직접 찍어도 된다. 같은 팩의 보석 아이콘을 먼저 찾아본다 |
| **한글** | 모든 팩의 글꼴이 영문뿐 | 7절의 한글 픽셀 글꼴을 따로 쓴다 |
| **LV1·LV2·LV3 작물** | 팩의 작물은 '자라는 단계'(씨앗→다 자람)다. '레벨'이 아니다 | LV마다 **다른 작물**을 쓴다(예: LV1 순무, LV2 호박, LV3 딸기). 성장 단계는 거둘 때까지의 진행 표시로 쓴다 |

### 한 팩으로 스타일을 맞출 수 있나

- **완전히 한 팩으로 끝나는 것은 Mana Seed와 LPC뿐이다.** 마을·실내·가구·작물·옷 갈아입기가 모두 같은 작가(또는 같은 규칙)로 그려져 있다.
  - Mana Seed는 **AI 금지 조항** 때문에 이 프로젝트에는 맞지 않는다(2절 3번).
  - LPC는 **32px**이고, 스타듀밸리보다는 옛 RPG 느낌이 강하다. 작가가 여럿이라 출처 표시가 길다.
- **Sprout Lands는 '아늑한 농장' 느낌이 가장 가깝다.** 마을·캐릭터 걷기·작물은 한 팩에 있다. 실내 가구와 스킨은 모자라다.
- **여러 팩을 섞을 때 생기는 문제**
  - **크기:** 16px과 32px을 섞으면 픽셀 굵기가 달라진다. 16px끼리라도 캐릭터 키가 다르다(어떤 팩은 16px, Mana Seed는 32px).
  - **색:** 팩마다 쓰는 색 수, 외곽선 색(검정 / 진한 갈색 / 없음), 그림자 방향이 다르다. Sprout Lands는 외곽선 없이 밝은 파스텔이고, Ninja Adventure는 진한 외곽선이 있다. 둘을 한 화면에 두면 바로 티가 난다.
  - **시점:** '바로 위에서'와 '비스듬히 위에서'(3/4 시점)가 섞이면 건물 지붕과 벽 비율이 어긋난다.
  - **줄이는 방법:** 섞더라도 **바깥(마을)과 안(집 안)처럼 한 화면에는 한 팩만** 쓴다. 꼭 섞어야 하면 한 팩의 색표(팔레트)로 다른 팩 그림의 색을 바꿔 맞춘다. 무료 도구인 Aseprite나 LibreSprite로 할 수 있다.

---

## 5. AI로 그림을 만드는 것은 현실적인가

**결론: 지금은 주 그림으로 쓰기 어렵다. 아이콘 몇 개나 참고 그림 정도만 된다.**

| 문제 | 왜 어려운가 |
|---|---|
| **진짜 픽셀이 아니다** | 이미지 AI는 '픽셀아트처럼 보이는' 큰 그림을 만든다. 칸이 고르지 않고 색이 수백 개라서, 16px 격자에 다시 맞춰 손으로 고쳐야 한다 |
| **일관성** | 같은 캐릭터를 다시 그려 달라고 하면 옷·비율·색이 조금씩 바뀐다. 스킨 여러 벌을 같은 몸에 맞추기 어렵다 |
| **타일 이어 붙이기** | 타일은 옆 칸과 끊김 없이 이어져야 한다(오토타일은 가장자리 조합이 47가지까지 된다). AI는 이 규칙을 지키지 못해 이음매가 보인다 |
| **애니메이션** | 걷기 4프레임이 같은 캐릭터로 조금씩만 움직여야 한다. AI는 프레임마다 얼굴과 옷이 달라진다 |
| **라이선스 충돌** | Mana Seed처럼 "AI 그림과 함께 쓰기 금지"인 팩이 있다. 또 AI 그림은 나라에 따라 저작권이 인정되지 않을 수 있다 |

쓸 만한 곳: 상점 간판 문구 같은 아이디어 잡기, 크리스탈 아이콘 같은 16px 단일 그림의 밑그림(손으로 다시 찍는다). 픽셀아트 전용 AI 도구도 있지만 이번에는 조사하지 않았다(확인 못 함).

---

## 6. 받은 뒤 프로젝트에 넣는 방법

### 폴더 위치 (제안)

Vite는 `frontend/public/` 안의 파일을 빌드할 때 그대로 복사하고, 화면에서는 `/village/...` 주소로 읽는다. 그림 파일은 import하지 않고 PixiJS가 주소로 불러오므로 여기에 둔다.

```
frontend/public/village/
  CREDITS.md            ← 출처 표시 (팩 이름, 작가, 링크, 라이선스, 받은 날짜)
  maps/
    village.tmj         ← Tiled에서 내보낸 마을 지도 (JSON)
    house.tmj           ← 집 안 지도
  tilesets/
    village.png         ← 타일셋 그림
    village.tsj         ← Tiled 타일셋 정보 (JSON)
    interior.png / interior.tsj
  sprites/
    player-default.png / player-default.json   ← 캐릭터 시트 + 아틀라스
    buildings.png / buildings.json
    crops.png / crops.json
    icons.png / icons.json      ← 코인, 크리스탈, 뽑기 아이템
  fonts/                ← 한글 픽셀 글꼴(npm으로 넣으면 필요 없음)
```

- **원본 압축 파일은 `frontend/public/` 밖에 둔다.** 예: `assets-src/village/` (빌드에 들어가지 않는다). 쓰는 그림만 잘라서 `public/village/`로 옮긴다.
- 저장소가 비공개이므로 `public/village/`의 그림은 커밋한다. 원본 압축 파일(`assets-src/`)은 용량만 차지하므로 `.gitignore`에 넣고, 받은 곳은 `CREDITS.md`에 적는다.
- 저장소를 공개로 바꾸게 되면 재배포 금지 그림을 `.gitignore`로 옮기고, `docs/dev/setup.md`에 "그림은 따로 받아 넣는다"를 적는다(2절 1번).

### Tiled로 지도 만들기

[Tiled](https://www.mapeditor.org/)는 무료 지도 편집기다(윈도우용 설치 파일이 있다).

1. **새 지도:** 직교(Orthogonal), 타일 크기 16×16, 지도 크기는 예를 들어 40×25칸.
2. **타일셋 불러오기:** `tilesets/village.png`를 열고 "Embed in map"을 끈 채 `.tsj`로 따로 저장한다. 그러면 여러 지도가 한 타일셋을 같이 쓴다.
3. **층(레이어) 나누기**
   - `ground` (풀·길·물), `decor` (꽃·돌), `above` (지붕·나뭇잎처럼 캐릭터를 덮는 것)
   - `collision` (걸을 수 없는 칸) — A* 길찾기가 이 층을 읽는다
   - `objects` (오브젝트 층) — 건물 문 위치, 건물 종류(`type: farm / house / shop / lab`), 캐릭터 시작점, 책장 자리를 점이나 사각형으로 찍는다. 코드는 이 이름으로 패널을 연다
4. **가장자리 자동 잇기:** 타일셋에 Terrain(Wang) set을 만들면 길과 풀밭 경계를 붓으로 칠할 때 자동으로 맞춰 준다.
5. **내보내기:** File → Export As → **JSON map files (`*.tmj`)**. 타일 데이터는 CSV로 둔다(읽기 쉽고 압축 해제가 필요 없다).
6. **애니메이션 타일**(물결 등)은 Tiled의 타일 애니메이션 편집기로 정하면 JSON에 함께 들어간다.

### PixiJS에서 불러오기 (개요)

PixiJS v8 기준이다. 실제 코드는 1단계 구현 때 쓴다.

- **지도:** 두 가지 길이 있다.
  - [`pixi-tiledmap` v2](https://cdn.jsdelivr.net/npm/pixi-tiledmap@2.4.0/README.md): v8용으로 새로 만든 라이브러리다. `.tmj`를 바로 읽고 모든 층과 애니메이션 타일을 지원한다고 적혀 있다. 써 보지는 못했다(확인 못 함).
  - 직접 읽기: `.tmj`는 단순한 JSON이다. 층마다 숫자 배열(타일 번호)이 있으므로, 번호로 타일셋 PNG의 좌표를 계산해 그린다. 그리는 일은 [`@pixi/tilemap`](https://github.com/pixijs/pixi-tilemap)(빠른 타일 그리기 전용, Tiled 파일은 못 읽음)이 맡는다. 지도가 40×25칸 정도라면 이 방법도 100줄 안팎이다.
- **캐릭터·아이콘:** `Assets.load('/village/sprites/player-default.json')`로 아틀라스를 읽는다. 아틀라스 JSON의 `animations`에 `walk-down: [프레임1, 프레임2, …]`를 적어 두면 `AnimatedSprite`에 그대로 넣을 수 있다. 팩에 아틀라스 JSON이 없으면 무료 도구로 만든다(예: [Free Texture Packer](https://free-tex-packer.com/), 또는 Aseprite의 시트 내보내기). 칸 크기가 일정한 시트라면 코드에서 격자로 잘라도 된다.
- **픽셀 선명하게:** 확대할 때 흐려지지 않게 텍스처의 `scaleMode`를 `'nearest'`로 두고, 확대 배율은 정수(2배·3배)로만 쓴다. 캔버스 CSS에는 `image-rendering: pixelated`를 준다.
- **스킨:** 스킨마다 같은 칸 배치의 시트를 하나씩 둔다(`player-default`, `player-farmer` …). 입은 스킨 이름(서버의 마을 상태)으로 어느 시트를 읽을지만 바꾼다. 건물 스킨도 같은 방식이다.

### 출처 표시는 어디에

1. **`frontend/public/village/CREDITS.md`** — 팩마다 이름, 작가, 원본 링크, 라이선스, 받은 날짜, 고친 점. 그림 옆에 두어서 그림과 함께 옮겨 다니게 한다.
2. **앱 화면 한 곳** — 마을 아래 메뉴에 '만든 사람들'(출처) 패널을 둔다. CC-BY·CC-BY-SA 팩을 쓰면 이것이 사실상 필수이고, 실제로 동작하는 화면이므로 "없는 기능 흉내 금지" 규칙에도 맞는다.
3. **저장소 맨 위 `README.md`** — 한 줄로 "마을 그림 출처는 `frontend/public/village/CREDITS.md`" 링크.

---

## 7. 한글 픽셀 글꼴

| 글꼴 | 라이선스 | 크기 | 한글 범위 | 넣는 방법 |
|---|---|---|---|---|
| **[Galmuri (갈무리)](https://github.com/quiple/galmuri)** | **SIL OFL 1.1** (무료, 상업 가능, 글꼴 파일 단독 판매만 금지) | Galmuri14(15px), Galmuri11(12px, 굵게·좁게 포함), Galmuri9(10px), Galmuri7(8px) | 11/9/14는 한글 음절 지원. Galmuri7은 4,358자만 | **npm `galmuri`** → `import 'galmuri/dist/galmuri.css'`. 또는 jsDelivr CDN |
| **[Neo둥근모 (NeoDunggeunmo)](https://github.com/neodgm/neodgm)** | **SIL OFL 1.1** | 16px 고정폭. 비례폭인 'Neo둥근모 Pro'도 있음 | 옛 DOS 시절 둥근모꼴 바탕, 현대 한글 지원 | 글꼴 파일을 `public/village/fonts/`에 두고 `@font-face` |

- **Galmuri를 추천한다.** 크기가 여러 개라 자원 줄(12px)과 패널 제목(15px)을 나눠 쓸 수 있고, npm 패키지가 있어 넣기 쉽다.
- **픽셀 글꼴은 원래 크기의 정수배로만 쓴다.** Galmuri11이면 12px·24px. 13px처럼 쓰면 글자가 뭉개진다.
- 이 글꼴은 대시보드 마을 안에서만 쓴다. 다른 화면은 Pretendard 그대로다([decisions/0003](../decisions/0003-dashboard-village.md)).
- OFL은 글꼴을 앱에 넣어 배포해도 되고, 라이선스 문구만 함께 두면 된다. npm으로 넣으면 패키지 안에 이미 들어 있다.

---

## 8. 고를 것과 추천

### 선택지

| | A. Sprout Lands로 시작 | B. 무료 CC0 팩(Ninja Adventure)으로 시작 | C. LPC로 한 번에 맞추기 |
|---|---|---|---|
| 돈 | 0원(기본판) → 마음에 들면 $3.99 | 0원 | 0원 |
| 스타듀밸리 느낌 | **가장 가깝다** (아늑한 파스텔 농장) | 덜하다 (모험 RPG 느낌) | 덜하다 (옛 RPG 느낌, 32px) |
| 마을·작물·걷기 | 다 있음 | 작물 확인 못 함 | 다 있음 |
| 실내·가구 | 확인 못 함 → 모자라면 다른 팩을 색 맞춰 섞음 | 있음(적음) | 있음 |
| 스킨 | 색 바꾸기로 만듦 | 캐릭터 50명 이상을 스킨으로 | 생성기로 많음 |
| 라이선스 부담 | 기본판 비상업(혼자 쓰니 괜찮음). **재배포 금지 → 저장소에 커밋하지 않음** | 없음 (CC0, 커밋해도 됨) | 출처 표시 의무, 작가 목록이 김 |

**고르지 않는 것:** Mana Seed는 가장 완성도가 높지만 "AI로 만든 코드와 함께 쓰기 금지" 조항이 이 프로젝트와 맞지 않는다. 값도 약 $83~$100이다.

### 추천: **A. Sprout Lands 기본판(무료)으로 1단계를 시작한다**

- 원하는 컨셉(스타듀밸리 같은 아늑한 마을)에 가장 가깝고, 마을·캐릭터 4방향 걷기·작물 단계라는 1~3단계 핵심이 한 팩에 있다.
- 혼자 쓰는 앱이라 기본판의 '비상업' 조건을 지킨다. 프리미엄($3.99)은 동작이 더 필요해지면 그때 사도 늦지 않다.
- 지도와 시트를 **칸 크기 16px, 파일 이름 규칙을 고정**해 두면 나중에 다른 팩으로 바꿀 때 PNG만 갈아 끼우면 된다. 이것으로 questions.md 17번의 "나중에 유료 팩으로 바꿀 수 있게"를 지킨다.
- 그림이 모자란 곳은 이렇게 메운다.
  - 상점·연구소: 집 그림에 소품을 얹는다.
  - 스킨: 색 바꾸기.
  - 책: 코드로 그린다.
  - 실내 가구: 5단계(집)에 갈 때 다시 본다. 그때 받아서 열어 본 뒤 모자라면 B나 다른 팩을 색 맞춰 섞을지 정한다.
- 내려받기 전에 확인할 것이었던 실내 타일과 가구는 **기본판에 들어 있다** (9절, 2026-10-09 확인).

### 정함 (2026-10-09 사용자 답변)

1. **A. Sprout Lands**로 한다.
2. **기본판(무료)**으로 시작한다. 프리미엄($3.99)은 동작이 더 필요해지면 그때 산다.
3. 저장소는 **비공개**다. 그림은 커밋한다. 공개로 바꾸기 전에 재배포 금지 그림을 뺀다.

### 다음 할 일

- ~~사용자가 기본판을 받아 압축을 푼다.~~ 2026-10-09 완료. 지금 위치: 바탕화면 `Sprout Lands - Sprites - Basic pack` (저장소 밖)
- ~~받은 파일을 열어 확인한다.~~ 2026-10-09 완료 → 9절
- ~~쓸 그림을 `frontend/public/village/`로 옮기고 `CREDITS.md`를 쓴다.~~ 2026-10-09 완료. 원본 팩은 `assets-src/village/sprout-lands/`(git 제외)에 두고 `scripts/build_village_assets.py`로 만든다


---

## 9. 받은 Sprout Lands 기본판 살펴보기 (2026-10-09)

바탕화면 `Sprout Lands - Sprites - Basic pack` 폴더를 열어 봤다. PNG 그림 약 40장과 `read_me.txt`가 있다. 이름만 다르고 내용이 같은 파일이 여러 쌍 있다(예: `Basic Furniture.png`와 `Basic_Furniture.png`). 칸 크기는 모두 **16px**이다.

### 들어 있는 것

| 파일 | 크기(px) | 내용 | 쓸 곳 |
|---|---|---|---|
| `Characters/Basic Charakter Spritesheet.png` | 192×192 | 캐릭터 하나(고양이 같은 아이). **48×48 칸, 4줄 × 4칸.** 줄 순서는 아래·위·왼쪽·오른쪽 방향이다. 줄마다 앞 2칸은 서 있기, 뒤 2칸은 걷기로 보인다 | 4방향 걷기 |
| `Characters/Basic Charakter Actions.png` | 96×576 | 48×48 칸, 2칸 × 12줄. 괭이·도끼·물뿌리개 동작이 4방향으로 2프레임씩 있다 | 밭 거두기 연출(나중에) |
| `Tilesets/Grass.png`, `Hills.png`, `Water.png`, `Tilled_Dirt*.png` | 176×112 등 | 풀밭·언덕·물·갈아 둔 밭흙 타일. 가장자리 이어 붙이기용 짝(`Bitmask references`)이 함께 있다 | 마을 바닥, 밭 |
| `Tilesets/Wooden House.png`, `Wooden_House_Walls_Tilset.png`, `Wooden_House_Roof_Tilset.png`, `Doors.png` | 112×80 등 | 나무집의 벽·지붕·문·창 타일, 안쪽 바닥 타일 | 집 겉모습, **집 안 벽과 바닥** |
| `Tilesets/Fences.png`, `Objects/Paths.png`, `Wood Bridge.png` | | 울타리, 길, 나무다리 | 마을 꾸밈 |
| `Objects/Basic Furniture.png` | 144×96 | 침대 3색, 의자, 탁자, 서랍장, 시계 3종, 화분 3종, 탁상 등 3색, 그림 3장, 러그 6종 | **집 안 가구** |
| `Objects/Basic Plants.png` | 96×32 | 작물 **2종**(밀처럼 생긴 노란 작물, 보라 열매 작물). 줄마다 씨앗 봉투 → 자라는 단계 4장 → 거둔 열매 아이콘 | 밭 작물 |
| `Objects/Basic Grass Biom things 1.png` | 144×80 | 나무 3종, 덤불, 버섯, 돌, 꽃, 해바라기, 그루터기, 열매 아이콘 | 마을 꾸밈 |
| `Objects/Chest.png` | 240×96 | 상자 열고 닫는 장면 (48×48 칸, 5칸 × 2줄) | **뽑기 연출**로 쓸 수 있다 |
| `Characters/Tools.png`, `Objects/Basic tools and meterials.png` | | 도구·나무·돌 아이콘 | 아이템 아이콘 |
| `Characters/Free Chicken Sprites.png`, `Free Cow Sprites.png`, `Egg_And_Nest.png`, `Free_Chicken_House.png` | | 닭·소와 닭장 | 마을 꾸밈(나중에) |
| `Sprout Lands color pallet/` | | 이 팩이 쓰는 색표(팔레트) | **다른 그림을 이 색에 맞출 때** 쓴다 |

### 없거나 모자란 것

| 필요한 것 | 기본판 상태 | 메울 방법 (기본값) |
|---|---|---|
| 작물 LV1·LV2·LV3 | 작물이 **2종**뿐이다 | LV1·LV2는 두 작물을 쓰고, LV3는 둘 중 하나의 색을 바꿔 만든다. 모자라면 프리미엄($3.99)에서 작물을 더 얻는다 |
| 상점·연구소 건물 | 나무집 타일 한 종류뿐 | 같은 나무집 타일로 크기와 지붕 색을 달리해 짓고, 문 앞에 상자(상점)·화분(연구소) 같은 소품을 둔다 |
| 책장 | 없다 | 서랍장 그림을 바탕으로 책장 틀을 16px로 그리고, 책 등은 코드로 그린다 |
| 코인·크리스탈 아이콘 | 없다 | 팔레트 색으로 16px 아이콘 두 개를 직접 찍는다 |
| 캐릭터 스킨 | 캐릭터 하나 | 팔레트 안에서 색 바꾸기로 만든다 |
| 건물 스킨 | 나무집 하나 | 지붕·벽 색 바꾸기로 만든다 |

### 라이선스 (`read_me.txt`, 기본판)

판매 페이지보다 자세하다. 요약하면 이렇다.

- 고쳐 써도 된다. 같은 스타일로 새 그림을 그려도 된다.
- **비상업 프로젝트에만** 쓴다. NFT와 **AI 학습**은 금지다. Mana Seed와 달리, AI와 함께 만든 프로젝트에서 쓰는 것을 막는 조항은 없다.
- 팩 자체를 다시 나눠 주거나 팔면 안 된다. 고쳤어도 마찬가지다. 그 그림으로 만든 프로젝트는 나눠 줘도 되고, 오픈 소스로 공개해도 된다. 오픈 소스라면 "그림 일부 또는 전부를 Cup Nooble이 만들었다"는 문구와 라이선스 조건을 함께 둔다.
- **출처 표시는 필수다.** 예시: `Assets -From : Sprout Lands -By : Cup Nooble`
  → 6절의 `CREDITS.md`와 마을 안 '만든 사람들' 패널에 이 문구를 넣는다.

---

## 참고한 곳 (2026-10-09 확인)

- Sprout Lands: https://cupnooble.itch.io/sprout-lands-asset-pack
- Sunnyside World: https://danieldiggle.itch.io/sunnyside
- Ninja Adventure: https://pixel-boy.itch.io/ninja-adventure-asset-pack
- LPC: https://lpc.opengameart.org/
- Mana Seed 목록: https://seliel-the-shaper.itch.io/ · 농부 캐릭터: https://seliel-the-shaper.itch.io/farmer-base · 라이선스: https://selieltheshaper.weebly.com/user-license.html
- Kenney: https://kenney.nl/assets/tiny-town · https://kenney.nl/assets/roguelike-rpg-pack
- LimeZu Serene Village revamped: https://limezu.itch.io/serenevillagerevamped
- Galmuri: https://github.com/quiple/galmuri
- Neo둥근모: https://github.com/neodgm/neodgm · https://www.sandollcloud.com/free-font/15873/NeoDunggeunmo
- pixi-tiledmap v2: https://cdn.jsdelivr.net/npm/pixi-tiledmap@2.4.0/README.md · @pixi/tilemap: https://github.com/pixijs/pixi-tilemap
- Tiled: https://www.mapeditor.org/
