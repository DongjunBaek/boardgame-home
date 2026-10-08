from fastapi.testclient import TestClient

from backend.app import store
from backend.app.main import app

client = TestClient(app)


def test_games_empty_when_no_file():
    res = client.get("/api/games")
    assert res.status_code == 200
    assert res.json() == []


def test_games_returns_saved_collection():
    games = [{"id": "manual:1", "title": "딕싯"}, {"id": "manual:2", "title": "카탄"}]
    store.save_collection(games)
    assert client.get("/api/games").json() == games


def test_corrupted_file_is_500_with_message():
    store.collection_path().parent.mkdir(parents=True)
    store.collection_path().write_text("[{깨짐", encoding="utf-8")
    res = client.get("/api/games")
    assert res.status_code == 500
    assert "손상" in res.json()["detail"]
