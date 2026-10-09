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
    assert saved == state
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
