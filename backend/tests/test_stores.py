import json

import pytest
from fastapi.testclient import TestClient

from backend.app import store
from backend.app.config import ROOT
from backend.app.main import app
from backend.app.stores import MAKER, MALL, FUNDING, STORES_FILE, seed_stores, store_id, store_key

client = TestClient(app)

SHARED_CASES = json.loads((ROOT / "shared" / "store_key_cases.json").read_text(encoding="utf-8"))["cases"]


@pytest.mark.parametrize("case", SHARED_CASES, ids=lambda c: str(c["url"]))
def test_store_key_shared_cases(case):
    assert store_key(case["url"]) == case["key"]


def game(gid, link, publisher=None):
    return {"id": gid, "title": gid, "sale_link": link, "publisher": publisher}


# 지금 데이터의 판매 링크 모양을 흉내 낸 목록
GAMES = [
    game("a", "https://smartstore.naver.com/udg/products/1", "언더독 게임즈"),
    game("b", "https://m.smartstore.naver.com/udg/products/2", "언더독 게임즈"),
    game("c", "https://smartstore.naver.com/saweolgames/products/3", "사월 게임즈"),
    game("d", "https://smartstore.naver.com/saweolgames/products/4", "Team GRK"),
    game("e", "https://smartstore.naver.com/manogames/products/5"),
    game("f", "https://www.boardm.co.kr/goods/1"),
    game("g", "https://boardm.co.kr/goods/2"),
    game("h", "https://m.yes24.com/Goods/1"),
    game("i", "https://tumblbug.com/abc"),
    game("j", "https://unknown-shop.kr/item/1"),
    game("k", None, "링크 없음"),
]


def test_seed_names_groups_and_order():
    stores = seed_stores(GAMES)
    got = [(s["group"], s["name"], s["url"]) for s in stores]
    assert got == [
        (MAKER, "manogames", "https://smartstore.naver.com/manogames"),  # 제작사 이름이 없으면 스토어 아이디
        (MAKER, "saweolgames", "https://smartstore.naver.com/saweolgames"),  # 제작사가 둘이면 스토어 아이디
        (MAKER, "언더독 게임즈", "https://smartstore.naver.com/udg"),
        (MALL, "보드엠", "https://www.boardm.co.kr"),
        (MALL, "예스24", "https://yes24.com"),
        (FUNDING, "텀블벅", "https://tumblbug.com"),
        ("기타", "unknown-shop.kr", "https://unknown-shop.kr"),
    ]
    assert stores[2]["id"] == store_id("smartstore.naver.com/udg")
    assert all(s["memo"] is None for s in stores)


def test_first_get_seeds_and_saves_once(isolated_data_dir):
    store.save_collection(GAMES)
    first = client.get("/api/stores").json()
    assert len(first) == 7
    assert (isolated_data_dir / STORES_FILE).exists()
    # 지운 뒤에 다시 불러도 다시 만들지 않는다
    client.delete(f"/api/stores/{first[0]['id']}")
    assert len(client.get("/api/stores").json()) == 6


def test_get_without_collection_gives_empty_list():
    assert client.get("/api/stores").json() == []


def test_create_update_delete():
    res = client.post("/api/stores", json={"name": " 다이브다이스 ", "url": "https://divedice.com", "group": "보드게임 쇼핑몰"})
    assert res.status_code == 201
    created = res.json()
    assert created == {
        "id": store_id("divedice.com"), "name": "다이브다이스", "url": "https://divedice.com",
        "group": "보드게임 쇼핑몰", "memo": None,
    }

    res = client.patch(f"/api/stores/{created['id']}", json={"memo": " 할인 많음 ", "group": ""})
    assert res.status_code == 200
    assert res.json() == {**created, "memo": "할인 많음", "group": None}

    assert client.delete(f"/api/stores/{created['id']}").status_code == 204
    assert client.get("/api/stores").json() == []
    assert client.delete(f"/api/stores/{created['id']}").status_code == 404


def test_duplicate_key_is_refused():
    client.post("/api/stores", json={"name": "언더독", "url": "https://smartstore.naver.com/udg"})
    res = client.post("/api/stores", json={"name": "또 언더독", "url": "https://m.smartstore.naver.com/udg/products/1"})
    assert res.status_code == 409
    assert "언더독" in res.json()["detail"]

    other = client.post("/api/stores", json={"name": "미겜", "url": "https://smartstore.naver.com/mysterygames"}).json()
    res = client.patch(f"/api/stores/{other['id']}", json={"url": "https://smartstore.naver.com/udg"})
    assert res.status_code == 409
    # 자기 주소를 그대로 다시 보내는 것은 괜찮다
    assert client.patch(f"/api/stores/{other['id']}", json={"url": "https://smartstore.naver.com/mysterygames/"}).status_code == 200


@pytest.mark.parametrize(
    "body, message",
    [
        ({"name": "x", "url": "smartstore.naver.com/udg"}, "주소: 주소는 http:// 또는 https://로 시작해야 합니다"),
        ({"name": "", "url": "https://a.com"}, "이름: 비울 수 없습니다"),
        ({"url": "https://a.com"}, "이름을 입력해 주세요"),
        ({"name": "x"}, "주소를 입력해 주세요"),
        ({"name": "x", "url": "https://a.com", "color": "red"}, "color: 고칠 수 없는 칸입니다"),
    ],
)
def test_invalid_input(body, message):
    res = client.post("/api/stores", json=body)
    assert res.status_code == 422
    assert res.json()["detail"] == message


def test_patch_unknown_store():
    assert client.patch("/api/stores/store:none", json={"name": "x"}).status_code == 404


def test_store_edits_do_not_touch_collection():
    store.save_collection(GAMES)
    client.post("/api/stores", json={"name": "새 스토어", "url": "https://new.kr"})
    assert store.load_collection() == GAMES
    # 백업도 파일마다 따로 남는다
    store.save_json(STORES_FILE, [])
    names = [p.name for p in store.backup_dir().iterdir()]
    assert any(n.startswith("stores-") for n in names)
    assert not any(n.startswith("collection-") for n in names)
