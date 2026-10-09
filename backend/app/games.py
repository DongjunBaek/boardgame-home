"""게임 추가·수정 규칙. 파일을 읽고 쓰지 않는 순수 함수와 입력 모델만 둔다 (저장은 main.py가 한다).

- 게임 ID는 바꾸지 않는다. 새 게임은 "manual:" + md5(제목) 앞 8자 (옛 Danseo와 같은 규칙).
- 고칠 수 없는 칸: id, source, extra, mine.added_at. 모르는 칸이 오면 거절한다 (오타로 엉뚱한 칸이 생기지 않게).
- 빈 글자는 null로 저장한다. 인원 표기는 정규화한다.
"""
import copy
import hashlib
from datetime import date as Date
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator

from backend.app.players import normalize_player_counts, parse_player_range

GENRES = ("보드게임", "머더미스터리")

# 입력 오류를 보여 줄 때 쓰는 칸 이름
FIELD_LABELS = {
    "title": "제목", "genres": "장르", "player_count": "인원", "play_time_minutes": "시간", "price": "정가",
    "publisher": "제작사", "sale_link": "판매 링크", "images": "이미지", "tags": "태그", "quantity": "개수",
    "played": "해봤음", "rating": "별점", "review": "후기", "notes": "메모", "date": "구입일", "paid": "구매가격",
    "shop": "산 곳",
    # 스토어 (stores.py)
    "name": "이름", "url": "주소", "group": "묶음", "memo": "메모",
    # 동아리 회비 (club.py)
    "monthly_fee": "월 금액", "exempt": "면제", "tier_id": "구분", "joined": "가입 월", "status": "상태",
    "status_since": "상태 시작 달", "kind": "종류", "amount": "금액", "paid_on": "낸 날", "method": "방법",
    "months": "개월 수",
}


def describe_error(err: dict) -> str:
    """pydantic 오류 하나 → "별점: 5 이하여야 합니다" 같은 한 줄."""
    field = next((str(x) for x in reversed(err["loc"]) if isinstance(x, str) and x != "body"), "")
    kind, ctx = err["type"], err.get("ctx") or {}
    if err.get("input", "") is None and kind not in ("value_error",):
        msg = "비울 수 없습니다"
    elif kind == "greater_than_equal":
        msg = f"{ctx['ge']} 이상이어야 합니다"
    elif kind == "less_than_equal":
        msg = f"{ctx['le']} 이하여야 합니다"
    elif kind == "string_too_short":
        msg = "비울 수 없습니다"
    elif kind in ("int_type", "int_parsing", "int_from_float"):
        msg = "정수여야 합니다"
    elif kind.startswith("date"):
        msg = "날짜(예: 2026-10-01)가 아닙니다"
    elif kind.startswith("bool"):
        msg = "참/거짓 값이 아닙니다"
    elif kind == "extra_forbidden":
        msg = "고칠 수 없는 칸입니다"
    else:
        msg = err["msg"].removeprefix("Value error, ")
    return f"{FIELD_LABELS.get(field, field)}: {msg}" if field else msg


class GameConflictError(Exception):
    """같은 제목의 게임이 이미 있다."""


def _clean_text(value):
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


# 아래 모델에서 "= None"인데 타입에 None이 없는 칸은 '안 보내면 그대로, null은 거절'이라는 뜻이다.
class PurchaseIn(_Strict):
    date: Date | None = None
    paid: Annotated[int, Field(ge=0)] | None = None
    shop: str | None = None

    _text = field_validator("shop", mode="before")(_clean_text)


class MineIn(_Strict):
    quantity: Annotated[int, Field(ge=1)] = None
    played: bool = None
    rating: Annotated[int, Field(ge=1, le=5)] | None = None
    review: str | None = None
    notes: str | None = None
    purchase: PurchaseIn = None

    _text = field_validator("review", "notes", mode="before")(_clean_text)


class GameIn(_Strict):
    title: Annotated[str, Field(min_length=1)] = None
    genres: list[str] = None
    player_count: list[str] = None
    play_time_minutes: Annotated[int, Field(ge=1)] | None = None
    price: Annotated[int, Field(ge=0)] | None = None
    publisher: str | None = None
    sale_link: str | None = None
    images: list[str] = None
    tags: list[str] = None
    mine: MineIn = None

    _text = field_validator("publisher", "sale_link", mode="before")(_clean_text)

    @field_validator("title", mode="before")
    @classmethod
    def _title(cls, v):
        return v.strip() if isinstance(v, str) else v

    @field_validator("genres")
    @classmethod
    def _genres(cls, v):
        unknown = [g for g in v if g not in GENRES]
        if unknown:
            raise ValueError(f"장르는 {'/'.join(GENRES)}만 쓸 수 있습니다: {unknown}")
        return [g for g in GENRES if g in v]  # 중복 제거, 순서 통일

    @field_validator("player_count")
    @classmethod
    def _players(cls, v):
        bad = [t for t in v if parse_player_range(t) is None]
        if bad:
            raise ValueError(f"인원 표기에 숫자가 없습니다: {bad}")
        return normalize_player_counts(v)

    @field_validator("sale_link")
    @classmethod
    def _link(cls, v):
        if v is not None and not v.startswith(("http://", "https://")):
            raise ValueError("판매 링크는 http:// 또는 https://로 시작해야 합니다")
        return v


def _changes(model: BaseModel) -> dict:
    """보낸 칸만 꺼낸다 (날짜는 'YYYY-MM-DD' 글자로)."""
    return model.model_dump(mode="json", exclude_unset=True)


def _merge(target: dict, changes: dict) -> None:
    for key, value in changes.items():
        if isinstance(value, dict) and isinstance(target.get(key), dict):
            _merge(target[key], value)
        else:
            target[key] = value


def _title_key(title: str) -> str:
    # 띄어쓰기는 게임마다 제각각이라("모텔노바디"/"모텔 노바디") 같은 제목인지 볼 때는 빼고 비교한다
    return "".join(title.split()).casefold()


def _check_title_free(games: list[dict], title: str, except_id: str | None = None) -> None:
    for g in games:
        if g["id"] != except_id and _title_key(g["title"]) == _title_key(title):
            raise GameConflictError(f"같은 제목의 게임이 이미 있습니다: {g['title']}")


def apply_patch(games: list[dict], game_id: str, patch: GameIn) -> list[dict]:
    """game_id 게임에 보낸 칸만 반영한 새 목록. 없는 ID면 KeyError."""
    new = copy.deepcopy(games)
    game = next((g for g in new if g["id"] == game_id), None)
    if game is None:
        raise KeyError(game_id)
    changes = _changes(patch)
    if "title" in changes:
        _check_title_free(new, changes["title"], except_id=game_id)
    _merge(game, changes)
    return new


def manual_id(title: str) -> str:
    return "manual:" + hashlib.md5(title.encode("utf-8")).hexdigest()[:8]


def new_game(games: list[dict], data: GameIn, now: datetime | None = None) -> dict:
    """새 게임 레코드. 제목은 꼭 있어야 하고, 같은 제목이 있으면 GameConflictError."""
    changes = _changes(data)
    title = changes.get("title")
    if not title:
        raise ValueError("제목을 입력해 주세요")
    _check_title_free(games, title)

    # 이름을 바꾼 옛 게임이 이 제목의 ID를 이미 쓰고 있을 수 있다
    ids = {g["id"] for g in games}
    game_id, n = manual_id(title), 2
    while game_id in ids:
        game_id, n = f"{manual_id(title)}-{n}", n + 1

    game = {
        "id": game_id,
        "title": title,
        "genres": [],
        "player_count": [],
        "play_time_minutes": None,
        "price": None,
        "publisher": None,
        "sale_link": None,
        "images": [],
        "tags": [],
        "source": "manual",
        "extra": {},
        "mine": {
            "quantity": 1,
            "played": False,
            "rating": None,
            "review": None,
            "notes": None,
            "added_at": (now or datetime.now()).isoformat(timespec="seconds"),
            "purchase": {"date": None, "paid": None, "shop": None},
        },
    }
    _merge(game, changes)
    return game
