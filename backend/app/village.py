"""대시보드 마을 미니게임 상태. 순수 함수와 입력 모델만 둔다 (저장은 main.py).

- 보드게임 데이터와 다른 파일(data/village.json)에 둔다. 서로 망가뜨리지 않게 하려는 것이다.
- 책장은 게임 목록(/api/games)을 그대로 읽으므로 여기에 게임 데이터를 복사하지 않는다.
- 밭 보상과 뽑기 결과는 나중 단계에서 서버가 계산한다 (docs/plan/v3-village.md).
"""
import copy
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

VILLAGE_FILE = "village.json"
VERSION = 1

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
