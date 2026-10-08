import json

import pytest

from backend.app.config import ROOT
from backend.app.players import normalize_player_counts, parse_player_range, supports_player_count

SHARED_CASES = json.loads((ROOT / "shared" / "player_cases.json").read_text(encoding="utf-8"))["supports"]


@pytest.mark.parametrize(
    "text, expected",
    [
        ("4인", (4, 4)),
        ("4인용", (4, 4)),
        ("2-4인", (2, 4)),
        ("2~4인", (2, 4)),
        ("2 - 4인", (2, 4)),
        ("6-3인", (3, 6)),
        ("7-14인", (7, 14)),
        ("5+gm", (5, 5)),
        ("인원 미정", None),
        ("", None),
        (None, None),
    ],
)
def test_parse_player_range(text, expected):
    assert parse_player_range(text) == expected


@pytest.mark.parametrize(
    "counts, n, expected",
    [
        (["2-4인"], 3, True),
        (["2-4인"], 5, False),
        (["2인", "4인"], 3, False),
        (["2인", "4인"], 4, True),
        (["5+gm"], 5, True),
        ([], 4, False),
        (None, 4, False),
    ],
)
def test_supports_player_count(counts, n, expected):
    assert supports_player_count(counts, n) is expected


@pytest.mark.parametrize("case", SHARED_CASES, ids=lambda c: f"{c['counts']}-{c['n']}")
def test_supports_player_count_shared_cases(case):
    # 화면(players.ts)도 같은 사례로 검사한다
    assert supports_player_count(case["counts"], case["n"]) is case["expected"]


@pytest.mark.parametrize(
    "counts, expected",
    [
        (["4-5인", "4인용", "5인용"], ["4-5인"]),
        (["2~4인"], ["2-4인"]),
        (["2인", "4인"], ["2인", "4인"]),
        (["4+gm"], ["4+gm"]),
        (["2-3인", "4-5인"], ["2-5인"]),
        (["4인", "4인"], ["4인"]),
        (["모름"], []),
        ([], []),
        (None, []),
    ],
)
def test_normalize_player_counts(counts, expected):
    assert normalize_player_counts(counts) == expected
