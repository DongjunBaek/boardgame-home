import json
from datetime import datetime

from fastapi.testclient import TestClient

from backend.app import village
from backend.app.main import app
from backend.app.store import backup_dir

client = TestClient(app)


def test_first_get_creates_default_state(isolated_data_dir):
    state = client.get("/api/village").json()
    assert state["coins"] == 0 and state["crystals"] == 0 and state["crop_level"] == 1
    assert state["player"] is None and state["skins"] == {"player": "default", "buildings": {}}
    saved = json.loads((isolated_data_dir / village.VILLAGE_FILE).read_text(encoding="utf-8"))
    # 파일에는 상태만, 화면에는 밭 계산·다음 연구·뽑기 정보·서버 시각을 더해 보낸다
    assert saved == {k: v for k, v in state.items() if k not in ("farm", "lab", "shop", "server_time")}
    # 두 번째로 읽어도 처음 만든 시각이 그대로다
    assert client.get("/api/village").json()["last_harvest"] == state["last_harvest"]


def test_put_player_saves_position_and_skips_same_position(isolated_data_dir):
    pos = {"map": "village", "x": 11, "y": 10, "facing": "up"}
    assert client.put("/api/village/player", json=pos).json()["player"] == pos
    assert client.get("/api/village").json()["player"] == pos
    backups = list(backup_dir().glob("village-*.json"))
    client.put("/api/village/player", json=pos)
    assert list(backup_dir().glob("village-*.json")) == backups


def test_put_player_validates():
    base = {"map": "village", "x": 1, "y": 1, "facing": "down"}
    assert client.put("/api/village/player", json={**base, "facing": "north"}).status_code == 422
    assert client.put("/api/village/player", json={**base, "map": "house"}).status_code == 422
    assert client.put("/api/village/player", json={**base, "x": -1}).status_code == 422
    assert client.put("/api/village/player", json={**base, "extra": 1}).status_code == 422


def test_normalize_fills_missing_keys_from_old_file():
    now = datetime(2026, 10, 9, 12, 0, 0)
    old = {"version": 1, "coins": 50, "skins": {"player": "farmer"}}
    got = village.normalize(old, now)
    assert got["coins"] == 50 and got["crystals"] == 0
    assert got["skins"] == {"player": "farmer", "buildings": {}}
    assert got["last_harvest"] == "2026-10-09T12:00:00"


def test_corrupted_file_is_not_overwritten(isolated_data_dir):
    isolated_data_dir.mkdir(parents=True, exist_ok=True)
    (isolated_data_dir / village.VILLAGE_FILE).write_text("[1, 2]", encoding="utf-8")
    res = client.get("/api/village")
    assert res.status_code == 500 and "손상" in res.json()["detail"]
    assert (isolated_data_dir / village.VILLAGE_FILE).read_text(encoding="utf-8") == "[1, 2]"


# ---------- 밭 ----------

T0 = datetime(2026, 10, 9, 9, 0, 0)


def state_at(last: datetime, level: int = 1, coins: int = 0) -> dict:
    s = village.default_state(last)
    s.update(crop_level=level, coins=coins)
    return s


def test_farm_counts_hours_and_caps_at_12():
    s = state_at(T0)
    assert village.farm(s, T0)["pending"] == 0
    assert village.farm(s, datetime(2026, 10, 9, 10, 30))["pending"] == 15  # 1.5시간 × 10
    assert village.farm(s, datetime(2026, 10, 10, 9, 0))["pending"] == 120  # 24시간이어도 12시간만
    assert village.farm(state_at(T0, level=3), datetime(2026, 10, 9, 10, 0))["pending"] == 60
    assert village.farm(s, T0)["full_at"] == "2026-10-09T21:00:00"
    # 시계가 뒤로 가면 0
    assert village.farm(s, datetime(2026, 10, 9, 8, 0))["pending"] == 0


def test_harvest_keeps_leftover_time_under_cap():
    s, got = village.harvest(state_at(T0, coins=5), datetime(2026, 10, 9, 9, 9, 0))  # 9분 = 1.5개
    assert got == 1 and s["coins"] == 6
    # 6분어치만 썼으니 3분은 남는다: 3분 더 지나면 또 하나
    assert s["last_harvest"].startswith("2026-10-09T09:06:00")
    assert village.farm(s, datetime(2026, 10, 9, 9, 12, 0))["pending"] == 1


def test_harvest_over_cap_restarts_from_now_and_nothing_to_harvest_changes_nothing():
    now = datetime(2026, 10, 10, 12, 0, 0)
    s, got = village.harvest(state_at(T0), now)
    assert got == 120 and s["last_harvest"] == "2026-10-10T12:00:00"
    same, zero = village.harvest(s, now)
    assert zero == 0 and same is s


def test_harvest_api_saves_and_returns_view(isolated_data_dir, monkeypatch):
    from backend.app import main

    monkeypatch.setattr(main, "_now", lambda: T0)
    first = client.get("/api/village").json()
    assert first["farm"] == {"rate_per_hour": 10, "cap_hours": 12, "pending": 0, "full_at": "2026-10-09T21:00:00"}
    assert first["server_time"] == "2026-10-09T09:00:00"
    assert client.post("/api/village/harvest").json()["harvested"] == 0

    monkeypatch.setattr(main, "_now", lambda: datetime(2026, 10, 9, 12, 0))
    res = client.post("/api/village/harvest").json()
    assert res["harvested"] == 30 and res["village"]["coins"] == 30 and res["village"]["farm"]["pending"] == 0
    saved = json.loads((isolated_data_dir / village.VILLAGE_FILE).read_text(encoding="utf-8"))
    assert saved["coins"] == 30 and "farm" not in saved and "server_time" not in saved


# ---------- 연구소 ----------


def test_lab_info_until_max_level():
    assert village.lab(state_at(T0)) == {"next_level": 2, "cost": 300, "next_rate": 25}
    assert village.lab(state_at(T0, level=2)) == {"next_level": 3, "cost": 1500, "next_rate": 60}
    assert village.lab(state_at(T0, level=3)) is None


def test_research_settles_farm_at_old_level_first():
    # 3시간 쌓임: 옛 레벨(10/시간)로 30을 먼저 거두고 300을 쓴다
    now = datetime(2026, 10, 9, 12, 0)
    s, harvested, cost = village.research(state_at(T0, coins=290), now)
    assert (harvested, cost) == (30, 300)
    assert s["coins"] == 20 and s["crop_level"] == 2
    assert village.farm(s, now)["pending"] == 0 and village.farm(s, now)["rate_per_hour"] == 25


def test_research_errors_change_nothing():
    poor = state_at(T0, coins=10)
    try:
        village.research(poor, datetime(2026, 10, 9, 10, 0))
    except village.ResearchError as e:
        assert "필요 300" in str(e) and "가진 코인 20" in str(e)
    else:
        raise AssertionError("코인이 모자라면 실패해야 한다")
    assert poor["coins"] == 10 and poor["crop_level"] == 1

    try:
        village.research(state_at(T0, level=3, coins=99999), T0)
    except village.ResearchError as e:
        assert "최고 레벨" in str(e)
    else:
        raise AssertionError("최고 레벨이면 실패해야 한다")


def test_research_api(isolated_data_dir, monkeypatch):
    from backend.app import main

    monkeypatch.setattr(main, "_now", lambda: T0)
    assert client.get("/api/village").json()["lab"] == {"next_level": 2, "cost": 300, "next_rate": 25}
    res = client.post("/api/village/research")
    assert res.status_code == 409 and "코인이 모자랍니다" in res.json()["detail"]
    assert not list(backup_dir().glob("village-*.json"))  # 실패하면 쓰지 않는다

    # 30시간 뒤: 12시간치 120을 거두고도 모자라므로, 코인을 넣어 두고 다시
    path = isolated_data_dir / village.VILLAGE_FILE
    saved = json.loads(path.read_text(encoding="utf-8"))
    path.write_text(json.dumps({**saved, "coins": 200}), encoding="utf-8")
    monkeypatch.setattr(main, "_now", lambda: datetime(2026, 10, 10, 15, 0))
    body = client.post("/api/village/research").json()
    assert body["harvested"] == 120 and body["cost"] == 300
    assert body["village"]["coins"] == 20 and body["village"]["crop_level"] == 2
    assert body["village"]["lab"]["next_level"] == 3


# ---------- 상점 뽑기 ----------

import random
from collections import Counter

from backend.app.config import ROOT


class FixedRng:
    """draw가 쓰는 두 메서드만 흉내 낸다. choices는 정해 둔 결과를, choice는 첫 가구를 돌려준다."""

    def __init__(self, pick: dict):
        self.pick = pick

    def choices(self, population, weights=None, k=1):
        return [self.pick]

    def choice(self, seq):
        return seq[0]


def test_every_furniture_has_a_picture():
    folder = ROOT / "frontend" / "public" / "village" / "items"
    missing = [i for i in village.FURNITURE if not (folder / f"{i}.png").is_file()]
    assert missing == []


def test_draw_follows_the_table_roughly():
    rng = random.Random(42)
    kinds = Counter(village.draw(rng)["kind"] for _ in range(5000))
    assert 0.66 < kinds["item"] / 5000 < 0.74
    assert 0.17 < kinds["coins"] / 5000 < 0.23
    assert 0.08 < kinds["crystals"] / 5000 < 0.12
    item = next(r for r in (village.draw(rng) for _ in range(50)) if r["kind"] == "item")
    assert item["name"] == village.FURNITURE[item["id"]]


def test_gacha_pays_and_stacks_duplicates():
    s = state_at(T0, coins=250)
    s, r1 = village.gacha(s, FixedRng({"kind": "item"}))
    s, r2 = village.gacha(s, FixedRng({"kind": "item"}))
    first = sorted(village.FURNITURE)[0]
    assert r1 == r2 == {"kind": "item", "id": first, "name": village.FURNITURE[first]}
    assert s["coins"] == 50 and s["items"] == [{"id": first, "count": 2}]


def test_gacha_currency_results_and_not_enough_coins():
    s, r = village.gacha(state_at(T0, coins=100), FixedRng({"kind": "crystals", "amount": 3}))
    assert r == {"kind": "crystals", "amount": 3} and s["crystals"] == 3 and s["coins"] == 0
    s, r = village.gacha(state_at(T0, coins=100), FixedRng({"kind": "coins", "amount": 150}))
    assert s["coins"] == 150
    poor = state_at(T0, coins=99)
    try:
        village.gacha(poor, random.Random(1))
    except village.GachaError as e:
        assert "필요 100" in str(e)
    else:
        raise AssertionError("코인이 모자라면 실패해야 한다")
    assert poor["coins"] == 99


def test_gacha_api(isolated_data_dir, monkeypatch):
    from backend.app import main

    monkeypatch.setattr(main.secrets, "SystemRandom", lambda: FixedRng({"kind": "item"}))
    shop = client.get("/api/village").json()["shop"]
    assert shop["cost"] == 100 and shop["names"]["bed-green"] == "초록 침대"
    res = client.post("/api/village/gacha")
    assert res.status_code == 409 and "코인이 모자랍니다" in res.json()["detail"]

    path = isolated_data_dir / village.VILLAGE_FILE
    saved = json.loads(path.read_text(encoding="utf-8"))
    path.write_text(json.dumps({**saved, "coins": 120}), encoding="utf-8")
    body = client.post("/api/village/gacha").json()
    assert body["result"]["kind"] == "item"
    assert body["village"]["coins"] == 20 and body["village"]["items"][0]["count"] == 1
