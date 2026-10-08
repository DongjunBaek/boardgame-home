"""옛 Danseo 보유 목록(handoff/collection.json)을 새 모양으로 옮긴다. 한 번만 쓰는 스크립트.

    .venv/Scripts/python -m scripts.migrate_from_danseo            # 미리보기만 (아무것도 저장하지 않음)
    .venv/Scripts/python -m scripts.migrate_from_danseo --apply    # data/collection.json에 저장

이미 data/collection.json이 있으면 덮어쓰지 않고 멈춘다 (화면에서 바꾼 내용을 지키기 위해).
"""
import argparse
import json
import sys
from collections import Counter
from pathlib import Path

from backend.app.config import ROOT
from backend.app.players import normalize_player_counts
from backend.app.store import collection_path, save_collection

HANDOFF = ROOT / "handoff"

# 그대로 옮기는 게임 정보 칸 (옛 이름 → 새 이름)
GAME_FIELDS = {
    "game_id": "id",
    "title": "title",
    "genres": "genres",
    "player_count": "player_count",
    "play_time_minutes": "play_time_minutes",
    "price": "price",
    "publisher": "publisher",
    "sale_link": "sale_link",
    "images": "images",
    "tags": "tags",
    "source": "source",
}
# 크롤링 때 쓰던 칸. 값이 있는 것만 extra에 참고용으로 보관한다
EXTRA_FIELDS = [
    "sale_status", "funding_status", "funding_link", "crawled_at", "release_date",
    "creator", "difficulty", "sellers", "review_count", "review_link", "rating_avg",
]
OWNED_FIELDS = {"added_at", "rating", "review", "notes"}

# 사용자가 알려준 개수 (HANDOFF: 카탄 3개, 스플렌더 2개). 확장 "카탄: 도시와 기사"는 따로 1개
QUANTITIES = {"manual:9b038089": 3, "manual:b89c0f95": 2}
# 플레이 기록에서 "나"를 찾을 이름 (people.json의 user_bdj)
MY_NAME = "백동준"


def _empty(value) -> bool:
    return value is None or value == "" or value == []


def plan_migration(old: list[dict], played_ids: set[str], quantities: dict[str, int]) -> tuple[list[dict], dict]:
    """옛 레코드 → (새 레코드, 바뀐 내용 보고). 파일을 읽거나 쓰지 않는다."""
    known = set(GAME_FIELDS) | set(EXTRA_FIELDS) | {"owned"}
    ids = {g["game_id"] for g in old}
    for game_id in [*quantities, *played_ids]:
        if game_id not in ids:
            raise ValueError(f"보유 목록에 없는 게임 ID: {game_id}")

    games, normalized, extra_counts = [], [], Counter()
    for g in old:
        unknown = set(g) - known
        if unknown:
            raise ValueError(f"{g['game_id']}: 처리 규칙이 없는 칸 {sorted(unknown)}")
        owned = g.get("owned") or {}
        if set(owned) - OWNED_FIELDS:
            raise ValueError(f"{g['game_id']}: 처리 규칙이 없는 보유 칸 {sorted(set(owned) - OWNED_FIELDS)}")

        game = {new: g.get(old_key) for old_key, new in GAME_FIELDS.items()}
        for key in ("genres", "player_count", "images", "tags"):
            game[key] = game[key] or []
        fixed = normalize_player_counts(game["player_count"])
        if fixed != game["player_count"]:
            normalized.append((game["id"], game["title"], game["player_count"], fixed))
            game["player_count"] = fixed

        game["extra"] = {k: g[k] for k in EXTRA_FIELDS if not _empty(g.get(k))}
        extra_counts.update(game["extra"].keys())
        game["mine"] = {
            "quantity": quantities.get(game["id"], 1),
            "played": game["id"] in played_ids,
            "rating": owned.get("rating"),
            "review": owned.get("review"),
            "notes": owned.get("notes"),
            "added_at": owned.get("added_at"),
            "purchase": {"date": None, "paid": None, "shop": None},
        }
        games.append(game)

    report = {
        "count": len(games),
        "normalized_players": normalized,
        "extra_counts": dict(extra_counts),
        "dropped_empty": [k for k in EXTRA_FIELDS if k not in extra_counts],
        "quantities": [(g["id"], g["title"], g["mine"]["quantity"]) for g in games if g["mine"]["quantity"] != 1],
        "played": [(g["id"], g["title"]) for g in games if g["mine"]["played"]],
    }
    return games, report


def blank_counts(games: list[dict], players="player_count", time="play_time_minutes", price="price") -> dict:
    return {
        "인원": sum(1 for g in games if not g.get(players)),
        "시간": sum(1 for g in games if g.get(time) is None),
        "가격": sum(1 for g in games if g.get(price) is None),
    }


def check_migration(old: list[dict], new: list[dict]) -> list[str]:
    """옮긴 결과 검사. 문제 목록을 돌려준다 (빈 목록 = 통과)."""
    problems = []
    if len(old) != len(new):
        problems.append(f"개수가 다름: {len(old)} → {len(new)}")
    if [g["game_id"] for g in old] != [g["id"] for g in new]:
        problems.append("게임 ID나 순서가 다름")
    if blank_counts(old) != blank_counts(new):
        problems.append(f"빈칸 수가 다름: {blank_counts(old)} → {blank_counts(new)}")
    for o, n in zip(old, new):
        owned = o.get("owned") or {}
        for key in ("rating", "review", "notes", "added_at"):
            if owned.get(key) != n["mine"][key]:
                problems.append(f"{o['game_id']}: 내 정보 {key}가 다름")
    return problems


def played_game_ids(plays: list[dict], me: str = MY_NAME) -> set[str]:
    return {p["game_id"] for p in plays if me in (p.get("players") or [])}


def format_report(games: list[dict], report: dict, problems: list[str]) -> str:
    genres = Counter(genre for g in games for genre in g["genres"])
    lines = [
        f"옮길 게임: {report['count']}개 (머더미스터리 {genres['머더미스터리']}, 보드게임 {genres['보드게임']})",
        f"빈칸: {blank_counts(games)}",
        "",
        "[새 항목 처음 값]",
        "  개수: 모두 1개, 다음만 다름",
        *[f"    - {title} ({gid}): {q}개" for gid, title, q in report["quantities"]],
        "  해봤음: 모두 '안 해봄', 다음만 '해봤음' (플레이 기록 기준)",
        *[f"    - {title} ({gid})" for gid, title in report["played"]],
        "  구입 정보(구입일·낸 가격·산 곳): 모두 빈칸",
        "",
        "[인원 표기 정리]",
        *([f"  - {t}: {before} → {after}" for _, t, before, after in report["normalized_players"]] or ["  바뀌는 것 없음"]),
        "",
        "[크롤링 칸 → 기타 정보(extra)로 보관]",
        *[f"  - {k}: {n}개 게임" for k, n in report["extra_counts"].items()],
        f"  모든 게임에서 비어 있어 옮기지 않는 칸: {', '.join(report['dropped_empty']) or '없음'}",
        "",
        "[검사]",
        *([f"  ✗ {p}" for p in problems] or ["  ✓ 개수·ID·순서·빈칸 수·내 정보(별점·후기·메모·추가일)가 원본과 같음"]),
    ]
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="data/collection.json에 저장")
    args = parser.parse_args(argv)
    sys.stdout.reconfigure(encoding="utf-8")

    old = json.loads((HANDOFF / "collection.json").read_text(encoding="utf-8"))
    plays = json.loads((HANDOFF / "plays.json").read_text(encoding="utf-8"))
    games, report = plan_migration(old, played_game_ids(plays), QUANTITIES)
    problems = check_migration(old, games)
    print(format_report(games, report, problems))
    print()

    if problems:
        print("검사에 실패해서 저장하지 않습니다.")
        return 1
    if not args.apply:
        print("미리보기입니다. 저장하려면 --apply를 붙여 다시 실행하세요.")
        return 0
    if collection_path().exists():
        print(f"이미 {collection_path()} 파일이 있어서 덮어쓰지 않습니다.")
        return 1
    save_collection(games)
    print(f"저장했습니다: {collection_path()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
