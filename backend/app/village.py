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

# 무엇이 나올지: (무게, 결과). 가구 70 · 코인 20 · 크리스탈 10 (가구 안에서는 모두 같은 확률)
GACHA_TABLE = [
    (70, {"kind": "item"}),
    (12, {"kind": "coins", "amount": 50}),
    (8, {"kind": "coins", "amount": 150}),
    (7, {"kind": "crystals", "amount": 1}),
    (3, {"kind": "crystals", "amount": 3}),
]


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
        "shop": {"cost": GACHA_COST, "names": FURNITURE},
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

