"""스토어 바로가기 목록 규칙 (data/stores.json). 파일을 읽고 쓰지 않는 순수 함수와 입력 모델만 둔다.

- 스토어 열쇠(store_key): 호스트에서 www./m.을 떼고, 네이버 스마트스토어는 첫 경로(스토어 아이디)까지 붙인다.
  게임의 판매 링크와 스토어 주소의 열쇠가 같으면 "그 스토어 게임"이다. 화면 frontend/src/lib/stores.ts와 같은 규칙
  (shared/store_key_cases.json으로 둘 다 검사).
- stores.json이 없으면 보유 게임의 판매 링크로 처음 목록을 만든다 (seed_stores).
- 열쇠가 같은 스토어는 두 번 넣지 않는다.
"""
import copy
import hashlib
from collections import Counter, defaultdict
from typing import Annotated
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator

STORES_FILE = "stores.json"

MAKER, MALL, FUNDING, OTHER = "제작사 스토어", "보드게임 쇼핑몰", "펀딩", "기타"
GROUP_ORDER = (MAKER, MALL, FUNDING)

# 스토어 아이디를 첫 경로에 두는 곳
_PATH_HOSTS = ("smartstore.naver.com", "brand.naver.com")

# 처음 목록을 만들 때 이름과 묶음을 붙일 아는 곳 (열쇠 → (이름, 묶음))
KNOWN_STORES = {
    "tumblbug.com": ("텀블벅", FUNDING),
    "wadiz.kr": ("와디즈", FUNDING),
    "boardm.co.kr": ("보드엠", MALL),
    "koreaboardgames.com": ("코리아보드게임즈", MALL),
    "popcone.co.kr": ("팝콘에디션", MALL),
    "yes24.com": ("예스24", MALL),
    "hobbygamemall.com": ("하비게임몰", MALL),
    "boardgamez.co.kr": ("보드게임즈", MALL),
    "divedice.com": ("다이브다이스", MALL),
    "lotusfroggames.co.kr": ("로투스프로그", MAKER),
}


class StoreConflictError(Exception):
    """같은 주소(열쇠)의 스토어가 이미 있다."""


def store_key(url: str | None) -> str | None:
    """'https://m.smartstore.naver.com/udg/products/1' → 'smartstore.naver.com/udg'. 주소가 아니면 None."""
    if not url:
        return None
    parts = urlsplit(url.strip())
    if parts.scheme not in ("http", "https") or not parts.hostname:
        return None
    host = parts.hostname.lower()
    for prefix in ("www.", "m."):
        host = host.removeprefix(prefix)
    if host in _PATH_HOSTS:
        first = next((p for p in parts.path.split("/") if p), "")
        return f"{host}/{first.lower()}" if first else host
    return host


def store_id(key: str) -> str:
    return "store:" + hashlib.md5(key.encode("utf-8")).hexdigest()[:8]


def _clean_text(value):
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


class StoreIn(BaseModel):
    """추가·수정 때 보내는 값. 보낸 칸만 바뀐다 ("= None"인데 타입에 None이 없는 칸은 null을 거절)."""

    model_config = ConfigDict(extra="forbid")

    name: Annotated[str, Field(min_length=1)] = None
    url: str = None
    group: str | None = None
    memo: str | None = None

    _text = field_validator("group", "memo", mode="before")(_clean_text)

    @field_validator("name", "url", mode="before")
    @classmethod
    def _strip(cls, v):
        return v.strip() if isinstance(v, str) else v

    @field_validator("url")
    @classmethod
    def _url(cls, v):
        if not v.startswith(("http://", "https://")):
            raise ValueError("주소는 http:// 또는 https://로 시작해야 합니다")
        if store_key(v) is None:
            raise ValueError("올바른 주소가 아닙니다")
        return v


def _check_key_free(stores: list[dict], url: str, except_id: str | None = None) -> None:
    key = store_key(url)
    for s in stores:
        if s["id"] != except_id and store_key(s["url"]) == key:
            raise StoreConflictError(f"같은 주소의 스토어가 이미 있습니다: {s['name']}")


def new_store(stores: list[dict], data: StoreIn) -> dict:
    changes = data.model_dump(exclude_unset=True)
    if not changes.get("name"):
        raise ValueError("이름을 입력해 주세요")
    if not changes.get("url"):
        raise ValueError("주소를 입력해 주세요")
    _check_key_free(stores, changes["url"])
    ids = {s["id"] for s in stores}
    sid, n = store_id(store_key(changes["url"])), 2
    while sid in ids:
        sid, n = f"{store_id(store_key(changes['url']))}-{n}", n + 1
    return {"id": sid, "name": changes["name"], "url": changes["url"], "group": changes.get("group"), "memo": changes.get("memo")}


def apply_store_patch(stores: list[dict], sid: str, patch: StoreIn) -> list[dict]:
    """sid 스토어에 보낸 칸만 반영한 새 목록. 없는 ID면 KeyError."""
    new = copy.deepcopy(stores)
    store = next((s for s in new if s["id"] == sid), None)
    if store is None:
        raise KeyError(sid)
    changes = patch.model_dump(exclude_unset=True)
    if "url" in changes:
        _check_key_free(new, changes["url"], except_id=sid)
    store.update(changes)
    return new


def seed_stores(games: list[dict]) -> list[dict]:
    """보유 게임의 판매 링크에서 처음 스토어 목록을 만든다."""
    links: dict[str, list[str]] = defaultdict(list)
    publishers: dict[str, set[str]] = defaultdict(set)
    for g in games:
        key = store_key(g.get("sale_link"))
        if key is None:
            continue
        links[key].append(g["sale_link"].strip())
        if (g.get("publisher") or "").strip():
            publishers[key].add(g["publisher"].strip())

    stores = []
    for key, urls in links.items():
        if key in KNOWN_STORES:
            name, group = KNOWN_STORES[key]
        elif "/" in key:
            # 스마트스토어: 그 링크를 쓰는 게임의 제작사가 하나면 그 이름, 아니면 스토어 아이디
            only = publishers[key]
            name, group = (next(iter(only)) if len(only) == 1 else key.split("/", 1)[1]), MAKER
        else:
            name, group = key, OTHER
        stores.append({"id": store_id(key), "name": name, "url": _home_url(key, urls), "group": group, "memo": None})
    return sorted(stores, key=lambda s: (_group_rank(s["group"]), s["name"].casefold()))


def _home_url(key: str, urls: list[str]) -> str:
    """스토어 첫 화면 주소. 상품 링크들 중 PC 주소(m. 아닌 것)를 가장 많이 쓴 호스트로."""
    hosts = Counter(urlsplit(u).netloc.lower() for u in urls)
    pc = [h for h, _ in hosts.most_common() if not h.startswith("m.")]
    host = pc[0] if pc else hosts.most_common(1)[0][0].removeprefix("m.")
    path = "/" + key.split("/", 1)[1] if "/" in key else ""
    return f"https://{host}{path}"


def _group_rank(group: str | None) -> int:
    return GROUP_ORDER.index(group) if group in GROUP_ORDER else len(GROUP_ORDER)
