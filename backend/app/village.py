"""대시보드 마을 미니게임 상태. 순수 함수와 입력 모델만 둔다 (저장은 main.py).

- 보드게임 데이터와 다른 파일(data/village.json)에 둔다. 서로 망가뜨리지 않게 하려는 것이다.
- 책장은 게임 목록(/api/games)을 그대로 읽으므로 여기에 게임 데이터를 복사하지 않는다.
- 밭 보상은 서버가 계산한다. 화면에서 계산하면 조작할 수 있어서다. 뽑기 결과도 나중 단계에서 서버가 정한다.
"""
import copy
from datetime import datetime, timedelta
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

VILLAGE_FILE = "village.json"
VERSION = 1

# 밭: 작물 레벨별 시간당 코인 (임시 숫자, docs/questions.md 18번). 화면을 꺼 둔 동안 FARM_CAP_HOURS까지 쌓인다
CROP_RATES = {1: 10, 2: 25, 3: 60}
FARM_CAP_HOURS = 12

MapName = Literal["village"]
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


def view(state: dict, now: datetime) -> dict:
    """화면에 보내는 모양: 저장된 상태 + 지금 시각 기준 밭 계산 + 서버 시각 (화면이 남은 시간을 셀 때 쓴다)."""
    return {**state, "farm": farm(state, now), "server_time": now.isoformat(timespec="seconds")}


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

