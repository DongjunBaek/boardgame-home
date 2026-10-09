"""동아리 회비 장부: 회비 구분 · 회원 · 달마다 납부 기록. 순수 함수와 입력 모델만 둔다 (저장은 main.py).

- 혼자 쓰는 장부다. 로그인·권한은 없다.
- 미납은 저장하지 않는다. 화면이 회원의 가입 월·상태와 납부 기록으로 계산한다 (frontend/src/lib/club.ts).
- 납부 기록은 (회원, 달)마다 하나다. 낼 때의 금액을 함께 적어서 구분 금액을 바꿔도 지난 기록은 그대로다.
- 회원은 지우지 않고 상태(휴면·탈퇴)를 바꾼다. 납부 기록이 없는 회원만 지울 수 있다 (잘못 만든 경우).
"""
import copy
import secrets
from datetime import date as Date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

TIERS_FILE = "club_tiers.json"
MEMBERS_FILE = "club_members.json"
PAYMENTS_FILE = "club_payments.json"

MONTH_PATTERN = r"^\d{4}-(0[1-9]|1[0-2])$"
Month = Annotated[str, Field(pattern=MONTH_PATTERN)]
Won = Annotated[int, Field(ge=0, le=10_000_000)]

# 처음 쓸 때 만드는 구분. 금액은 사용자가 적는다 (null = 아직 안 정함)
DEFAULT_TIERS = [
    {"name": "정회원", "monthly_fee": None, "exempt": False},
    {"name": "준회원", "monthly_fee": None, "exempt": False},
    {"name": "면제", "monthly_fee": 0, "exempt": True},
]


class ClubConflictError(Exception):
    pass


def _new_id(prefix: str, taken: set[str]) -> str:
    while True:
        nid = f"{prefix}:{secrets.token_hex(4)}"
        if nid not in taken:
            return nid


def _clean_text(value):
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


def seed_tiers() -> list[dict]:
    taken: set[str] = set()
    tiers = []
    for t in DEFAULT_TIERS:
        tid = _new_id("tier", taken)
        taken.add(tid)
        tiers.append({"id": tid, **t})
    return tiers


def next_month(month: str, n: int = 1) -> str:
    y, m = map(int, month.split("-"))
    total = y * 12 + (m - 1) + n
    return f"{total // 12:04d}-{total % 12 + 1:02d}"


# ---------- 회비 구분 ----------


class TierIn(BaseModel):
    """보낸 칸만 바뀐다."""

    model_config = ConfigDict(extra="forbid")

    name: Annotated[str, Field(min_length=1)] = None
    monthly_fee: Won | None = None
    exempt: bool = None

    @field_validator("name", mode="before")
    @classmethod
    def _strip(cls, v):
        return v.strip() if isinstance(v, str) else v


def _check_tier_name_free(tiers: list[dict], name: str, except_id: str | None = None) -> None:
    if any(t["id"] != except_id and t["name"] == name for t in tiers):
        raise ClubConflictError(f"같은 이름의 구분이 이미 있습니다: {name}")


def new_tier(tiers: list[dict], data: TierIn) -> dict:
    changes = data.model_dump(exclude_unset=True)
    if not changes.get("name"):
        raise ValueError("이름을 입력해 주세요")
    _check_tier_name_free(tiers, changes["name"])
    return {
        "id": _new_id("tier", {t["id"] for t in tiers}),
        "name": changes["name"],
        "monthly_fee": changes.get("monthly_fee"),
        "exempt": changes.get("exempt", False),
    }


def apply_tier_patch(tiers: list[dict], tid: str, patch: TierIn) -> list[dict]:
    new = copy.deepcopy(tiers)
    tier = next((t for t in new if t["id"] == tid), None)
    if tier is None:
        raise KeyError(tid)
    changes = patch.model_dump(exclude_unset=True)
    if "name" in changes:
        _check_tier_name_free(new, changes["name"], except_id=tid)
    tier.update(changes)
    return new


def check_tier_unused(members: list[dict], tid: str) -> None:
    used = [m["name"] for m in members if m["tier_id"] == tid]
    if used:
        raise ClubConflictError(f"이 구분을 쓰는 회원이 있어 지울 수 없습니다: {', '.join(used)}")


# ---------- 회원 ----------

MemberStatus = Literal["active", "paused", "left"]


class MemberIn(BaseModel):
    """보낸 칸만 바뀐다. status_since는 휴면·탈퇴가 시작된 달 (활동이면 null)."""

    model_config = ConfigDict(extra="forbid")

    name: Annotated[str, Field(min_length=1)] = None
    tier_id: str = None
    joined: Month = None
    status: MemberStatus = None
    status_since: Month | None = None
    memo: str | None = None

    _text = field_validator("memo", mode="before")(_clean_text)

    @field_validator("name", mode="before")
    @classmethod
    def _strip(cls, v):
        return v.strip() if isinstance(v, str) else v


def _check_member(member: dict, tiers: list[dict], members: list[dict]) -> None:
    if not any(t["id"] == member["tier_id"] for t in tiers):
        raise ValueError(f"없는 구분입니다: {member['tier_id']}")
    if member["status"] == "active":
        member["status_since"] = None
    elif member["status_since"] is None:
        raise ValueError("휴면·탈퇴는 시작한 달을 적어 주세요")
    elif member["status_since"] < member["joined"]:
        raise ValueError("휴면·탈퇴 시작 달이 가입 월보다 앞섭니다")
    # 탈퇴한 회원과는 이름이 같아도 된다 (다시 가입하거나 동명이인)
    if member["status"] != "left" and any(
        m["id"] != member["id"] and m["name"] == member["name"] and m["status"] != "left" for m in members
    ):
        raise ClubConflictError(f"같은 이름의 회원이 이미 있습니다: {member['name']}")


def new_member(members: list[dict], tiers: list[dict], data: MemberIn) -> dict:
    changes = data.model_dump(exclude_unset=True)
    for key, msg in (("name", "이름을 입력해 주세요"), ("tier_id", "구분을 골라 주세요"), ("joined", "가입 월을 입력해 주세요")):
        if not changes.get(key):
            raise ValueError(msg)
    member = {
        "id": _new_id("member", {m["id"] for m in members}),
        "name": changes["name"],
        "tier_id": changes["tier_id"],
        "joined": changes["joined"],
        "status": changes.get("status", "active"),
        "status_since": changes.get("status_since"),
        "memo": changes.get("memo"),
    }
    _check_member(member, tiers, members)
    return member


def apply_member_patch(members: list[dict], tiers: list[dict], mid: str, patch: MemberIn) -> list[dict]:
    new = copy.deepcopy(members)
    member = next((m for m in new if m["id"] == mid), None)
    if member is None:
        raise KeyError(mid)
    member.update(patch.model_dump(exclude_unset=True))
    _check_member(member, tiers, new)
    return new


def check_member_removable(payments: list[dict], mid: str) -> None:
    if any(p["member_id"] == mid for p in payments):
        raise ClubConflictError("납부 기록이 있는 회원은 지울 수 없습니다. 상태를 '탈퇴'로 바꿔 주세요")


# ---------- 납부 기록 ----------

PaymentKind = Literal["paid", "exempt"]
PaymentMethod = Literal["bank", "cash", "other"]


class PaymentIn(BaseModel):
    """한 칸 기록. months가 2 이상이면 그 달부터 이어지는 여러 달을 같은 내용으로 적는다 (몇 달 치를 한 번에 낸 경우)."""

    model_config = ConfigDict(extra="forbid")

    kind: PaymentKind = "paid"
    amount: Won | None = None
    paid_on: Date | None = None
    method: PaymentMethod | None = None
    memo: str | None = None
    months: Annotated[int, Field(ge=1, le=12)] = 1

    _text = field_validator("memo", mode="before")(_clean_text)


def put_payments(payments: list[dict], members: list[dict], mid: str, month: str, data: PaymentIn) -> tuple[list[dict], list[dict]]:
    """(새 전체 목록, 이번에 적은 기록들). 첫 달은 덮어쓰고, 이어지는 달에 이미 기록이 있으면 거절한다."""
    if not any(m["id"] == mid for m in members):
        raise KeyError(mid)
    if data.kind == "paid" and data.amount is None:
        raise ValueError("금액을 입력해 주세요")
    months = [next_month(month, i) for i in range(data.months)]
    taken = {p["month"] for p in payments if p["member_id"] == mid}
    clash = [m for m in months[1:] if m in taken]
    if clash:
        raise ClubConflictError(f"이미 기록이 있는 달이 있습니다: {', '.join(clash)}")
    written = [
        {
            "member_id": mid,
            "month": m,
            "kind": data.kind,
            "amount": data.amount if data.kind == "paid" else None,
            "paid_on": data.paid_on.isoformat() if data.paid_on and data.kind == "paid" else None,
            "method": data.method if data.kind == "paid" else None,
            "memo": data.memo,
        }
        for m in months
    ]
    rest = [p for p in payments if not (p["member_id"] == mid and p["month"] == month)]
    return sorted([*rest, *written], key=lambda p: (p["month"], p["member_id"])), written


def remove_payment(payments: list[dict], mid: str, month: str) -> list[dict]:
    rest = [p for p in payments if not (p["member_id"] == mid and p["month"] == month)]
    if len(rest) == len(payments):
        raise KeyError(f"{mid} {month}")
    return rest
