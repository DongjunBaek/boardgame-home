"""대시보드 마을 미니게임 상태. 순수 함수와 입력 모델만 둔다 (저장은 main.py).

- 보드게임 데이터와 다른 파일(data/village.json)에 둔다. 서로 망가뜨리지 않게 하려는 것이다.
- 책장은 게임 목록(/api/games)을 그대로 읽으므로 여기에 게임 데이터를 복사하지 않는다.
- 밭 보상은 서버가 계산한다. 화면에서 계산하면 조작할 수 있어서다. 뽑기 결과도 나중 단계에서 서버가 정한다.
"""
import copy
import random
from datetime import datetime, timedelta
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

VILLAGE_FILE = "village.json"
VERSION = 1

# 밭: 작물 레벨별 시간당 코인 (임시 숫자, docs/questions.md 18번). 화면을 꺼 둔 동안 FARM_CAP_HOURS까지 쌓인다
CROP_RATES = {1: 10, 2: 25, 3: 60}
FARM_CAP_HOURS = 12
# 연구소: 그 레벨로 올리는 데 드는 코인 (임시 숫자, docs/questions.md 29번). 시간은 걸리지 않는다
CROP_COSTS = {2: 300, 3: 1500}
MAX_CROP_LEVEL = max(CROP_RATES)


# 상점 뽑기 (임시 숫자, docs/questions.md 21·30번). 한 번에 코인 GACHA_COST
GACHA_COST = 100

# 뽑기 가구: id → 이름. 그림은 frontend/public/village/items/<id>.png (scripts/build_village_assets.py가 자른다)
FURNITURE = {
    "bed-green": "초록 침대",
    "bed-blue": "하늘 침대",
    "bed-pink": "분홍 침대",
    "dresser": "서랍장",
    "table": "나무 탁자",
    "chair": "나무 의자",
    "cabinet": "작은 수납장",
    "side-table": "협탁",
    "stool": "나무 걸상",
    "clock-cat": "고양이 시계",
    "clock-round": "둥근 시계",
    "clock-small": "작은 시계",
    "lamp-green": "초록 등",
    "lamp-blue": "하늘 등",
    "lamp-pink": "분홍 등",
    "painting-flowers": "꽃 그림",
    "painting-field": "들판 그림",
    "painting-night": "밤하늘 그림",
    "pot-sunflower": "해바라기 화분",
    "pot-sprout": "새싹 화분",
    "pot-blue-flower": "파란 꽃 화분",
    "rug-small-green": "작은 초록 러그",
    "rug-small-pink": "작은 분홍 러그",
    "rug-small-blue": "작은 하늘 러그",
    "rug-green": "초록 러그",
    "rug-pink": "분홍 러그",
    "rug-blue": "하늘 러그",
}

# 무엇이 나올지: (무게, 결과). 가구 60 · 코인 20 · 크리스탈 20 (가구 안에서는 모두 같은 확률)
# 2026-10-10 크리스탈을 10% → 20%로 올렸다 (뽑기 한 번에 평균 0.16개 → 0.34개)
GACHA_TABLE = [
    (60, {"kind": "item"}),
    (12, {"kind": "coins", "amount": 50}),
    (8, {"kind": "coins", "amount": 150}),
    (13, {"kind": "crystals", "amount": 1}),
    (7, {"kind": "crystals", "amount": 3}),
]


# 스킨: 캐릭터는 고양이 색, 건물은 지붕 색 (그림은 scripts/build_village_assets.py가 팔레트로 색만 바꿔 만든다)
PLAYER_SKINS = {"default": "크림 고양이", "brown": "갈색 고양이", "gray": "회색 고양이", "black": "까만 고양이"}
ROOFS = {"wood": "나무 지붕", "rose": "장밋빛 지붕", "teal": "청록 지붕", "slate": "남색 지붕", "gold": "황금 지붕", "plum": "자두색 지붕"}
BUILDINGS = ("house", "shop", "lab")
# 건물마다 처음 지붕. 이 지붕들과 기본 고양이는 처음부터 가진 것으로 본다
DEFAULT_ROOFS = {"house": "wood", "shop": "rose", "lab": "teal"}
# 크리스탈 뽑기 (임시 숫자, docs/questions.md 31번): 아직 없는 스킨 중 하나가 같은 확률로 나온다
SKIN_GACHA_COST = 3

SkinTarget = Literal["player", "house", "shop", "lab"]


class SkinIn(BaseModel):
    """입힐 스킨. target이 player면 고양이 id, 건물이면 지붕 id"""

    model_config = ConfigDict(extra="forbid")

    target: SkinTarget
    skin: str


# 꾸미기: 집 안에 놓을 수 있는 칸 (frontend/public/village/maps/house.tmj의 방. 위 벽 줄 0은 그림·시계용)
HOUSE_X = (1, 12)
HOUSE_Y = (0, 7)
MAX_PLACED = 200


class PlacedIn(BaseModel):
    """놓은 가구 하나. (x, y)는 그림의 왼쪽 아래가 닿는 칸"""

    model_config = ConfigDict(extra="forbid")

    uid: Annotated[str, Field(min_length=1, max_length=60)]
    item: str
    x: int
    y: int


class DecorIn(BaseModel):
    """집 안에 놓은 가구 전체. 보낸 목록으로 통째로 바꾼다"""

    model_config = ConfigDict(extra="forbid")

    placed: Annotated[list[PlacedIn], Field(max_length=MAX_PLACED)]


class GachaError(Exception):
    """뽑을 수 없는 경우 (코인 모자람). 화면에 그대로 보여 줄 문장을 담는다."""


class ResearchError(Exception):
    """올릴 수 없는 경우 (최고 레벨, 코인 모자람). 화면에 그대로 보여 줄 문장을 담는다."""

# 지도: 마을, 집 안 (frontend/public/village/maps/<이름>.tmj)
MapName = Literal["village", "house"]
Facing = Literal["down", "up", "left", "right"]


class PlayerIn(BaseModel):
    """캐릭터가 마지막으로 서 있던 칸. 다음에 열면 그 자리에서 시작한다."""

    model_config = ConfigDict(extra="forbid")

    map: MapName
    x: Annotated[int, Field(ge=0, le=255)]
    y: Annotated[int, Field(ge=0, le=255)]
    facing: Facing


def default_state(now: datetime) -> dict:
    return {
        "version": VERSION,
        "coins": 0,
        "crystals": 0,
        "crop_level": 1,
        "last_harvest": now.isoformat(timespec="seconds"),
        "items": [],
        "skins": {"player": "default", "buildings": {}},
        # 뽑기로 얻은 스킨 ("player:brown", "roof:slate"). 처음부터 가진 것은 넣지 않는다
        "owned_skins": [],
        # 집 안에 놓은 가구 [{uid, item, x, y}]
        "placed": [],
        # 지도 위 자리. None이면 지도의 시작점(spawn)에 선다
        "player": None,
    }


def normalize(state: dict | None, now: datetime) -> dict:
    """파일에 없는 칸은 기본값으로 채운다 (나중 단계에서 칸이 늘어나도 옛 파일을 그대로 읽게)."""
    base = default_state(now)
    if state is None:
        return base
    merged = {**base, **copy.deepcopy(state)}
    merged["skins"] = {**base["skins"], **(state.get("skins") or {})}
    return merged


def set_player(state: dict, data: PlayerIn) -> dict:
    new = copy.deepcopy(state)
    new["player"] = data.model_dump()
    return new


def _rate(state: dict) -> int:
    return CROP_RATES.get(state["crop_level"], CROP_RATES[max(CROP_RATES)])


def farm(state: dict, now: datetime) -> dict:
    """밭에 지금 쌓인 코인. 마지막으로 거둔 뒤 흐른 시간(최대 FARM_CAP_HOURS)으로 계산한다."""
    rate = _rate(state)
    since = datetime.fromisoformat(state["last_harvest"])
    cap = timedelta(hours=FARM_CAP_HOURS)
    # 시계가 뒤로 간 경우(시각을 고친 PC 등)는 0으로 본다
    elapsed = min(max(now - since, timedelta(0)), cap)
    return {
        "rate_per_hour": rate,
        "cap_hours": FARM_CAP_HOURS,
        "pending": int(elapsed.total_seconds() * rate // 3600),
        "full_at": (since + cap).isoformat(timespec="seconds"),
    }


def lab(state: dict) -> dict | None:
    """다음 레벨 연구 정보. 최고 레벨이면 None."""
    level = state["crop_level"] + 1
    if level > MAX_CROP_LEVEL:
        return None
    return {"next_level": level, "cost": CROP_COSTS[level], "next_rate": CROP_RATES[level]}


def view(state: dict, now: datetime) -> dict:
    """화면에 보내는 모양: 저장된 상태 + 지금 시각 기준 밭 계산 + 다음 연구 + 뽑기 값·가구 이름 + 서버 시각."""
    return {
        **state,
        "farm": farm(state, now),
        "lab": lab(state),
        "shop": {"cost": GACHA_COST, "names": FURNITURE, "skin_cost": SKIN_GACHA_COST, "skins_left": len(missing_skins(state))},
        "wardrobe": {
            "players": PLAYER_SKINS,
            "roofs": ROOFS,
            "default_roofs": DEFAULT_ROOFS,
            "owned": owned_skins(state),
        },
        "server_time": now.isoformat(timespec="seconds"),
    }


def harvest(state: dict, now: datetime) -> tuple[dict, int]:
    """쌓인 코인을 거둔다. (새 상태, 거둔 코인). 거둘 것이 없으면 상태를 바꾸지 않는다.

    한도 안이면 코인 한 개가 되기 전 자투리 시간은 남겨 둔다 (자주 거둬도 손해가 없게).
    한도를 넘겼으면 넘긴 시간은 버리고 지금부터 다시 센다.
    """
    info = farm(state, now)
    got = info["pending"]
    if got == 0:
        return state, 0
    new = copy.deepcopy(state)
    new["coins"] += got
    since = datetime.fromisoformat(state["last_harvest"])
    if now - since >= timedelta(hours=FARM_CAP_HOURS):
        new["last_harvest"] = now.isoformat(timespec="seconds")
    else:
        used = timedelta(seconds=got * 3600 / info["rate_per_hour"])
        new["last_harvest"] = (since + used).isoformat(timespec="milliseconds")
    return new, got


def research(state: dict, now: datetime) -> tuple[dict, int, int]:
    """작물 레벨을 하나 올린다. (새 상태, 먼저 거둔 코인, 쓴 코인).

    레벨을 올리기 전에 밭에 쌓인 코인을 옛 레벨로 먼저 거둔다.
    그러지 않으면 지난 시간까지 새 레벨로 계산되어 코인이 더 생긴다.
    """
    info = lab(state)
    if info is None:
        raise ResearchError("이미 최고 레벨입니다")
    settled, harvested = harvest(state, now)
    if settled["coins"] < info["cost"]:
        raise ResearchError(f"코인이 모자랍니다 (필요 {info['cost']}, 가진 코인 {settled['coins']})")
    new = copy.deepcopy(settled)
    new["coins"] -= info["cost"]
    new["crop_level"] = info["next_level"]
    return new, harvested, info["cost"]


def draw(rng: random.Random) -> dict:
    """뽑기 결과 하나. 가구면 {"kind": "item", "id", "name"}, 재화면 {"kind": "coins"|"crystals", "amount"}."""
    weights = [w for w, _ in GACHA_TABLE]
    result = dict(rng.choices([r for _, r in GACHA_TABLE], weights=weights)[0])
    if result["kind"] == "item":
        item_id = rng.choice(sorted(FURNITURE))
        result.update(id=item_id, name=FURNITURE[item_id])
    return result


def gacha(state: dict, rng: random.Random) -> tuple[dict, dict]:
    """코인을 내고 한 번 뽑는다. (새 상태, 결과). 같은 가구가 또 나오면 개수만 늘린다."""
    if state["coins"] < GACHA_COST:
        raise GachaError(f"코인이 모자랍니다 (필요 {GACHA_COST}, 가진 코인 {state['coins']})")
    result = draw(rng)
    new = copy.deepcopy(state)
    new["coins"] -= GACHA_COST
    if result["kind"] == "item":
        owned = next((it for it in new["items"] if it["id"] == result["id"]), None)
        if owned:
            owned["count"] += 1
        else:
            new["items"].append({"id": result["id"], "count": 1})
    else:
        new[result["kind"]] += result["amount"]
    return new, result


def owned_skins(state: dict) -> dict:
    """가진 스킨: {"player": [고양이 id], "roof": [지붕 id]} (처음부터 가진 것 포함, 목록 순서대로)"""
    got = set(state.get("owned_skins") or [])
    base_roofs = set(DEFAULT_ROOFS.values())
    return {
        "player": [k for k in PLAYER_SKINS if k == "default" or f"player:{k}" in got],
        "roof": [k for k in ROOFS if k in base_roofs or f"roof:{k}" in got],
    }


def missing_skins(state: dict) -> list[str]:
    """아직 없는 스킨 ("player:brown" 꼴)"""
    owned = owned_skins(state)
    return [f"player:{k}" for k in PLAYER_SKINS if k not in owned["player"]] + [
        f"roof:{k}" for k in ROOFS if k not in owned["roof"]
    ]


def skin_name(skin_id: str) -> str:
    group, key = skin_id.split(":")
    return (PLAYER_SKINS if group == "player" else ROOFS)[key]


def skin_gacha(state: dict, rng: random.Random) -> tuple[dict, dict]:
    """크리스탈을 내고 아직 없는 스킨 하나를 얻는다. (새 상태, {"kind": "skin", "id", "name"})"""
    left = missing_skins(state)
    if not left:
        raise GachaError("모든 스킨을 이미 가졌습니다")
    if state["crystals"] < SKIN_GACHA_COST:
        raise GachaError(f"크리스탈이 모자랍니다 (필요 {SKIN_GACHA_COST}, 가진 크리스탈 {state['crystals']})")
    skin_id = rng.choice(left)
    new = copy.deepcopy(state)
    new["crystals"] -= SKIN_GACHA_COST
    new["owned_skins"] = [*new.get("owned_skins", []), skin_id]
    return new, {"kind": "skin", "id": skin_id, "name": skin_name(skin_id)}


def wear(state: dict, data: SkinIn) -> dict:
    """가진 스킨을 입힌다. 없거나 모르는 스킨이면 ValueError."""
    owned = owned_skins(state)
    new = copy.deepcopy(state)
    if data.target == "player":
        if data.skin not in owned["player"]:
            raise ValueError(f"가지지 않은 캐릭터 스킨입니다: {data.skin}")
        new["skins"]["player"] = data.skin
    else:
        if data.skin not in owned["roof"]:
            raise ValueError(f"가지지 않은 지붕입니다: {data.skin}")
        new["skins"]["buildings"] = {**new["skins"].get("buildings", {}), data.target: data.skin}
    return new


def decorate(state: dict, data: DecorIn) -> dict:
    """집 안 가구 배치를 통째로 바꾼다. 가진 개수보다 많거나, 방 밖이거나, 모르는 가구면 ValueError."""
    owned = {it["id"]: it["count"] for it in state["items"]}
    used: dict[str, int] = {}
    seen: set[str] = set()
    for p in data.placed:
        if p.item not in FURNITURE:
            raise ValueError(f"모르는 가구입니다: {p.item}")
        if not (HOUSE_X[0] <= p.x <= HOUSE_X[1] and HOUSE_Y[0] <= p.y <= HOUSE_Y[1]):
            raise ValueError(f"방 밖에는 놓을 수 없습니다: {FURNITURE[p.item]} ({p.x}, {p.y})")
        if p.uid in seen:
            raise ValueError(f"같은 uid가 두 번 있습니다: {p.uid}")
        seen.add(p.uid)
        used[p.item] = used.get(p.item, 0) + 1
        if used[p.item] > owned.get(p.item, 0):
            raise ValueError(f"가진 것보다 많이 놓았습니다: {FURNITURE[p.item]} (가진 개수 {owned.get(p.item, 0)})")
    new = copy.deepcopy(state)
    new["placed"] = [p.model_dump() for p in data.placed]
    return new

