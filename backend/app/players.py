"""인원 표기 해석. 옛 Danseo(players.py)와 같은 규칙을 새로 구현했다.

표기 예: "4인", "4인용", "2-4인", "2~4인", "5+gm"(게임마스터가 필요한 게임).
한 게임에 표기가 여러 개일 수 있다: ["4-5인", "4인용", "5인용"].
"""
import re
from collections.abc import Iterable

_NUMBERS = re.compile(r"(\d+)(?:\s*[-~]\s*(\d+))?")


def parse_player_range(text: str | None) -> tuple[int, int] | None:
    """표기 하나 → (최소, 최대). 숫자가 없으면 None. "6-3인"처럼 거꾸로 적어도 (3, 6)."""
    match = _NUMBERS.search(text or "")
    if not match:
        return None
    first = int(match.group(1))
    second = int(match.group(2)) if match.group(2) else first
    return min(first, second), max(first, second)


def supports_player_count(player_counts: Iterable[str] | None, count: int) -> bool:
    """표기 중 하나라도 count명을 포함하면 True. 인원 정보가 없으면 False."""
    for text in player_counts or []:
        parsed = parse_player_range(text)
        if parsed and parsed[0] <= count <= parsed[1]:
            return True
    return False


def normalize_player_counts(player_counts: Iterable[str] | None) -> list[str]:
    """여러 표기를 하나로 합친다. 이어지지 않는 인원은 따로 둔다. 숫자 없는 표기는 버린다.

    ["4-5인", "4인용", "5인용"] → ["4-5인"],  ["2~4인"] → ["2-4인"],  ["2인", "4인"] → ["2인", "4인"]
    표기 중 하나라도 gm이 있으면 모두 "+gm"으로 쓴다: ["4+gm"] → ["4+gm"]
    """
    counts: set[int] = set()
    gm = False
    for text in player_counts or []:
        parsed = parse_player_range(text)
        if parsed:
            counts.update(range(parsed[0], parsed[1] + 1))
            gm = gm or "gm" in text.lower()
    suffix = "+gm" if gm else "인"

    runs: list[list[int]] = []
    for count in sorted(counts):
        if runs and count == runs[-1][1] + 1:
            runs[-1][1] = count
        else:
            runs.append([count, count])
    return [f"{low}{suffix}" if low == high else f"{low}-{high}{suffix}" for low, high in runs]
