"""동아리 회계록: 입금·출금 기록. 순수 함수와 입력 모델만 둔다 (저장은 main.py).

- 혼자 쓰는 장부다. 잔액은 한 곳(통장·현금 합친 것)으로 보고, 0원에서 시작한다.
- 회비 납부는 여기에 저장하지 않는다. 화면이 회비 납부 기록(club_payments.json)을 읽어 '회비' 입금으로 함께 보여 준다
  (frontend/src/lib/ledger.ts). 두 번 적지 않게 하려는 것이다.
- 잔액도 저장하지 않고 화면이 날짜순으로 더해 계산한다.
"""
import copy
import secrets
from datetime import date as Date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

LEDGER_FILE = "club_ledger.json"

EntryKind = Literal["in", "out"]


def _clean_text(value):
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


class EntryIn(BaseModel):
    """추가·수정 때 보내는 값. 보낸 칸만 바뀐다."""

    model_config = ConfigDict(extra="forbid")

    date: Date = None
    kind: EntryKind = None
    amount: Annotated[int, Field(ge=1, le=100_000_000)] = None
    category: str | None = None
    description: Annotated[str, Field(min_length=1)] = None
    memo: str | None = None

    _text = field_validator("category", "memo", mode="before")(_clean_text)

    @field_validator("description", mode="before")
    @classmethod
    def _strip(cls, v):
        return v.strip() if isinstance(v, str) else v


def _sorted(entries: list[dict]) -> list[dict]:
    return sorted(entries, key=lambda e: (e["date"], e["id"]))


def new_entry(entries: list[dict], data: EntryIn) -> dict:
    changes = data.model_dump(exclude_unset=True)
    for key, msg in (("date", "날짜를 입력해 주세요"), ("kind", "입금·출금을 골라 주세요"), ("amount", "금액을 입력해 주세요"), ("description", "내용을 입력해 주세요")):
        if changes.get(key) is None:
            raise ValueError(msg)
    taken = {e["id"] for e in entries}
    eid = f"entry:{secrets.token_hex(4)}"
    while eid in taken:
        eid = f"entry:{secrets.token_hex(4)}"
    return {
        "id": eid,
        "date": changes["date"].isoformat(),
        "kind": changes["kind"],
        "amount": changes["amount"],
        "category": changes.get("category"),
        "description": changes["description"],
        "memo": changes.get("memo"),
    }


def add_entry(entries: list[dict], data: EntryIn) -> tuple[list[dict], dict]:
    entry = new_entry(entries, data)
    return _sorted([*entries, entry]), entry


def apply_entry_patch(entries: list[dict], eid: str, patch: EntryIn) -> list[dict]:
    """eid 기록에 보낸 칸만 반영한 새 목록. 없는 ID면 KeyError."""
    new = copy.deepcopy(entries)
    entry = next((e for e in new if e["id"] == eid), None)
    if entry is None:
        raise KeyError(eid)
    changes = patch.model_dump(exclude_unset=True)
    if "date" in changes:
        changes["date"] = changes["date"].isoformat()
    entry.update(changes)
    return _sorted(new)
