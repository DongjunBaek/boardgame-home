import pytest
from fastapi.testclient import TestClient

from backend.app import store
from backend.app.games import manual_id
from backend.app.main import app

client = TestClient(app)


def record(game_id, title, **over):
    game = {
        "id": game_id, "title": title, "genres": ["보드게임"], "player_count": ["2-4인"],
        "play_time_minutes": 30, "price": 59000, "publisher": "코리아보드게임즈", "sale_link": None,
        "images": [], "tags": ["카드 게임"], "source": "naver-x", "extra": {"sale_status": ["판매중"]},
        "mine": {
            "quantity": 1, "played": False, "rating": None, "review": None, "notes": "메모",
            "added_at": "2026-05-14T17:44:24", "purchase": {"date": None, "paid": None, "shop": None},
        },
    }
    game.update(over)
    return game


@pytest.fixture
def saved():
    games = [record("manual:a", "딕싯"), record("naver:1", "망령 열차", genres=["머더미스터리"])]
    store.save_collection(games)
    return games


def by_id(game_id):
    return next(g for g in store.load_collection() if g["id"] == game_id)


# --- 고치기 ---

def test_patch_only_changes_sent_fields(saved):
    res = client.patch("/api/games/manual:a", json={"mine": {"quantity": 3, "played": True}})
    assert res.status_code == 200
    game = by_id("manual:a")
    assert res.json() == game
    assert game["mine"]["quantity"] == 3 and game["mine"]["played"] is True
    # 보내지 않은 칸은 그대로
    assert game["mine"]["notes"] == "메모" and game["mine"]["added_at"] == "2026-05-14T17:44:24"
    assert game["title"] == "딕싯" and game["extra"] == {"sale_status": ["판매중"]}
    assert by_id("naver:1") == saved[1]


def test_patch_makes_backup(saved):
    client.patch("/api/games/manual:a", json={"mine": {"rating": 5}})
    backups = list(store.backup_dir().glob("collection-*.json"))
    assert len(backups) == 1


def test_patch_cleans_and_normalizes(saved):
    res = client.patch(
        "/api/games/manual:a",
        json={
            "title": "  딕싯 오디세이 ",
            "genres": ["머더미스터리", "보드게임", "보드게임"],
            "player_count": ["4-5인", "5인용"],
            "publisher": "   ",
            "mine": {"review": "", "rating": None, "purchase": {"date": "2026-10-01", "paid": 45000, "shop": " 보드엠 "}},
        },
    )
    assert res.status_code == 200, res.text
    game = by_id("manual:a")
    assert game["id"] == "manual:a"  # 제목이 바뀌어도 ID는 그대로
    assert game["title"] == "딕싯 오디세이"
    assert game["genres"] == ["보드게임", "머더미스터리"]
    assert game["player_count"] == ["4-5인"]
    assert game["publisher"] is None and game["mine"]["review"] is None
    assert game["mine"]["purchase"] == {"date": "2026-10-01", "paid": 45000, "shop": "보드엠"}


def test_patch_can_clear_nullable_fields(saved):
    client.patch("/api/games/manual:a", json={"price": None, "play_time_minutes": None, "player_count": []})
    game = by_id("manual:a")
    assert game["price"] is None and game["play_time_minutes"] is None and game["player_count"] == []


@pytest.mark.parametrize(
    "body, label",
    [
        ({"mine": {"rating": 6}}, "별점"),
        ({"mine": {"rating": 0}}, "별점"),
        ({"mine": {"quantity": 0}}, "개수"),
        ({"mine": {"quantity": None}}, "개수"),
        ({"mine": {"played": None}}, "해봤음"),
        ({"price": -1}, "정가"),
        ({"play_time_minutes": 0}, "시간"),
        ({"title": "   "}, "제목"),
        ({"title": None}, "제목"),
        ({"genres": ["파티게임"]}, "장르"),
        ({"player_count": ["많이"]}, "인원"),
        ({"sale_link": "smartstore.naver.com"}, "판매 링크"),
        ({"mine": {"purchase": {"date": "2026-13-01"}}}, "구입일"),
        ({"id": "manual:x"}, "id"),
        ({"extra": {}}, "extra"),
        ({"mine": {"added_at": "x"}}, "added_at"),
    ],
)
def test_patch_rejects_bad_input_without_saving(saved, body, label):
    res = client.patch("/api/games/manual:a", json=body)
    assert res.status_code == 422
    assert label in res.json()["detail"]
    assert store.load_collection() == saved


def test_patch_unknown_game_is_404(saved):
    assert client.patch("/api/games/manual:zzz", json={"mine": {"rating": 3}}).status_code == 404


def test_patch_title_to_existing_title_is_409(saved):
    res = client.patch("/api/games/manual:a", json={"title": "망령  열차"})
    assert res.status_code == 409
    assert "같은 제목" in res.json()["detail"]
    assert store.load_collection() == saved


def test_patch_same_title_on_itself_is_fine(saved):
    assert client.patch("/api/games/manual:a", json={"title": "딕싯"}).status_code == 200


# --- 추가 ---

def test_create_with_defaults(saved):
    res = client.post("/api/games", json={"title": "스플렌더", "genres": ["보드게임"], "price": 65000})
    assert res.status_code == 201, res.text
    game = res.json()
    assert game["id"] == manual_id("스플렌더")
    assert game["source"] == "manual" and game["extra"] == {} and game["player_count"] == []
    assert game["mine"]["quantity"] == 1 and game["mine"]["played"] is False
    assert game["mine"]["added_at"]
    assert store.load_collection()[-1] == game


def test_create_requires_title(saved):
    assert client.post("/api/games", json={"price": 1000}).status_code == 422
    assert client.post("/api/games", json={"title": " "}).status_code == 422
    assert store.load_collection() == saved


@pytest.mark.parametrize("title", ["딕싯", "딕 싯", " 딕  싯 ", "망령열차"])
def test_create_duplicate_title_is_409_ignoring_spaces(saved, title):
    res = client.post("/api/games", json={"title": title})
    assert res.status_code == 409
    assert store.load_collection() == saved


def test_create_avoids_id_taken_by_renamed_game():
    # 처음 제목이 '카탄'이었다가 이름을 바꾼 게임이 manual_id('카탄')을 쓰고 있다
    store.save_collection([record(manual_id("카탄"), "카탄 (옛 판)")])
    res = client.post("/api/games", json={"title": "카탄"})
    assert res.status_code == 201
    assert res.json()["id"] == manual_id("카탄") + "-2"


# --- 삭제 ---

def test_delete(saved):
    assert client.delete("/api/games/manual:a").status_code == 204
    assert [g["id"] for g in store.load_collection()] == ["naver:1"]
    assert client.delete("/api/games/manual:a").status_code == 404


@pytest.mark.parametrize(
    "body, message",
    [
        ({"mine": {"rating": 6}}, "별점: 5 이하여야 합니다"),
        ({"mine": {"quantity": 0}}, "개수: 1 이상이어야 합니다"),
        ({"mine": {"quantity": None}}, "개수: 비울 수 없습니다"),
        ({"price": "많이"}, "정가: 정수여야 합니다"),
        ({"title": " "}, "제목: 비울 수 없습니다"),
        ({"mine": {"purchase": {"date": "어제"}}}, "구입일: 날짜(예: 2026-10-01)가 아닙니다"),
        ({"extra": {}}, "extra: 고칠 수 없는 칸입니다"),
    ],
)
def test_error_messages_are_korean(saved, body, message):
    assert client.patch("/api/games/manual:a", json=body).json()["detail"] == message
