import copy
import json

import pytest

from backend.app import store
from scripts import migrate_from_danseo as m


def old_game(game_id, title, **overrides):
    game = {
        "game_id": game_id, "title": title, "player_count": ["4인"], "play_time_minutes": 60,
        "price": 30000, "publisher": "제작사", "creator": None, "difficulty": None,
        "sale_status": ["판매중"], "sale_link": None, "funding_status": None, "funding_link": None,
        "sellers": [], "images": [], "release_date": None, "review_count": None, "review_link": None,
        "rating_avg": None, "source": "manual", "crawled_at": "2026-05-14T17:44:24", "genres": ["보드게임"],
        "tags": [], "owned": {"added_at": "2026-05-14T17:44:24", "rating": None, "review": None, "notes": None},
    }
    game.update(overrides)
    return game


OLD = [
    old_game("manual:a", "카탄", owned={"added_at": "t1", "rating": 4, "review": "좋다", "notes": None}),
    old_game("naver:1", "머더", player_count=["4-5인", "5인용"], price=None, genres=["머더미스터리"]),
    old_game("manual:b", "모름", player_count=[], play_time_minutes=None),
]


def test_plan_maps_fields_and_sets_new_items():
    games, report = m.plan_migration(OLD, {"naver:1"}, {"manual:a": 3})
    catan, murder, unknown = games
    assert catan["id"] == "manual:a" and "game_id" not in catan
    assert catan["mine"] == {
        "quantity": 3, "played": False, "rating": 4, "review": "좋다", "notes": None,
        "added_at": "t1", "purchase": {"date": None, "paid": None, "shop": None},
    }
    assert murder["mine"]["played"] is True and murder["mine"]["quantity"] == 1
    assert murder["player_count"] == ["4-5인"]
    assert report["normalized_players"] == [("naver:1", "머더", ["4-5인", "5인용"], ["4-5인"])]
    assert report["quantities"] == [("manual:a", "카탄", 3)]
    assert report["played"] == [("naver:1", "머더")]
    assert unknown["player_count"] == [] and unknown["play_time_minutes"] is None


def test_plan_keeps_only_filled_crawl_fields_in_extra():
    games, report = m.plan_migration(OLD, set(), {})
    assert games[0]["extra"] == {"sale_status": ["판매중"], "crawled_at": "2026-05-14T17:44:24"}
    assert "sale_status" not in games[0]
    assert "creator" in report["dropped_empty"] and "sale_status" not in report["dropped_empty"]
    assert report["extra_counts"] == {"sale_status": 3, "crawled_at": 3}


def test_extra_counts_with_mixed_value_types():
    mixed = [old_game("manual:a", "x"), old_game("manual:b", "y", sellers=["텀블벅"], funding_status="펀딩중")]
    _, report = m.plan_migration(mixed, set(), {})
    assert report["extra_counts"] == {"sale_status": 2, "crawled_at": 2, "sellers": 1, "funding_status": 1}


def test_plan_does_not_change_input():
    before = copy.deepcopy(OLD)
    m.plan_migration(OLD, {"naver:1"}, {"manual:a": 3})
    assert OLD == before


def test_plan_rejects_unknown_fields():
    with pytest.raises(ValueError, match="처리 규칙이 없는 칸"):
        m.plan_migration([old_game("manual:a", "x", surprise=1)], set(), {})
    with pytest.raises(ValueError, match="보유 칸"):
        m.plan_migration([old_game("manual:a", "x", owned={"count": 2})], set(), {})


def test_plan_rejects_ids_not_in_collection():
    with pytest.raises(ValueError, match="manual:zzz"):
        m.plan_migration(OLD, set(), {"manual:zzz": 2})


def test_check_migration_passes_and_detects_problems():
    games, _ = m.plan_migration(OLD, set(), {})
    assert m.check_migration(OLD, games) == []
    broken = copy.deepcopy(games)
    broken[0]["price"] = None
    broken[1]["mine"]["rating"] = 5
    problems = m.check_migration(OLD, broken)
    assert any("빈칸 수" in p for p in problems)
    assert any("naver:1: 내 정보 rating" in p for p in problems)
    assert m.check_migration(OLD, games[:2]) != []


def test_played_game_ids_only_counts_me():
    plays = [{"game_id": "g1", "players": ["백동준", "강승묵"]}, {"game_id": "g2", "players": ["강승묵"]}]
    assert m.played_game_ids(plays) == {"g1"}


@pytest.fixture
def handoff(tmp_path, monkeypatch):
    folder = tmp_path / "handoff"
    folder.mkdir()
    (folder / "collection.json").write_text(json.dumps(OLD, ensure_ascii=False), encoding="utf-8")
    plays = [{"game_id": "naver:1", "players": ["백동준"]}]
    (folder / "plays.json").write_text(json.dumps(plays, ensure_ascii=False), encoding="utf-8")
    monkeypatch.setattr(m, "HANDOFF", folder)
    monkeypatch.setattr(m, "QUANTITIES", {"manual:a": 3})
    return folder


def test_main_preview_writes_nothing(handoff, capsys):
    assert m.main([]) == 0
    assert not store.collection_path().exists()
    assert "미리보기" in capsys.readouterr().out


def test_main_apply_saves_and_refuses_to_overwrite(handoff, capsys):
    assert m.main(["--apply"]) == 0
    saved = store.load_collection()
    assert [g["id"] for g in saved] == ["manual:a", "naver:1", "manual:b"]
    assert saved[1]["mine"]["played"] is True

    saved[0]["title"] = "사용자가 바꾼 제목"
    store.save_collection(saved)
    assert m.main(["--apply"]) == 1
    assert store.load_collection()[0]["title"] == "사용자가 바꾼 제목"
    assert "덮어쓰지 않습니다" in capsys.readouterr().out
