"""마을 그림 만들기: assets-src/village/sprout-lands(원본 팩) → frontend/public/village(앱이 읽는 그림).

- 원본 팩은 저장소에 올리지 않는다(.gitignore). 다시 받으면 같은 자리에 풀고 이 스크립트를 돌린다.
- 타일셋은 그대로 복사하고, Tiled 타일셋 정보(.tsj)를 만든다.
- 건물(집·상점·연구소)은 지붕·벽·문 조각을 이어 붙여 한 장짜리 그림으로 만든다.
  상점·연구소 지붕은 팩 팔레트 안에서 색만 바꾼다(다른 색을 섞지 않으려고).
- 지도(maps/*.tmj)는 만들지 않는다. Tiled에서 고친 것을 덮어쓰지 않게 따로 둔다.

실행: python scripts/build_village_assets.py  (Pillow가 필요하다: pip install pillow. 서버 .venv에는 넣지 않는다)
"""
import json
import shutil
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets-src" / "village" / "sprout-lands"
OUT = ROOT / "frontend" / "public" / "village"
T = 16

# 타일셋: 이름 → 원본 파일. 칸 크기는 모두 16px
TILESETS = {
    "water": "Tilesets/Water.png",
    "grass": "Tilesets/Grass.png",
    "dirt": "Tilesets/Tilled_Dirt.png",
    "fences": "Tilesets/Fences.png",
    "nature": "Objects/Basic Grass Biom things 1.png",
    "crops": "Objects/Basic Plants.png",
}

# 지붕 색 바꾸기: 원래 지붕 갈색 5단계 → 팔레트의 다른 5단계 (어두운 것부터)
ROOF = ["#754c60", "#90625d", "#aa7959", "#b68962", "#c49a6c"]
ROOF_SWAPS = {
    "shop": ["#713970", "#8a4a70", "#a35b70", "#af6776", "#bd757e"],  # 장밋빛
    "lab": ["#505e77", "#5f7a79", "#6e967c", "#82a884", "#97bb8e"],  # 청록빛
}


def src(rel: str) -> Image.Image:
    return Image.open(SRC / rel).convert("RGBA")


def tile(sheet: Image.Image, index: int) -> Image.Image:
    cols = sheet.width // T
    x, y = index % cols * T, index // cols * T
    return sheet.crop((x, y, x + T, y + T))


def stretch_x(piece: Image.Image, width: int, left: int, right: int) -> Image.Image:
    """가로 9-slice: 왼쪽 left px와 오른쪽 right px는 그대로 두고, 가운데 한 줄을 되풀이해 width로 늘린다."""
    out = Image.new("RGBA", (width, piece.height))
    out.alpha_composite(piece.crop((0, 0, left, piece.height)), (0, 0))
    out.alpha_composite(piece.crop((piece.width - right, 0, piece.width, piece.height)), (width - right, 0))
    strip = piece.crop((left, 0, left + 1, piece.height))
    for x in range(left, width - right):
        out.alpha_composite(strip, (x, 0))
    return out


def recolor(im: Image.Image, before: list[str], after: list[str]) -> Image.Image:
    table = {_rgb(b): _rgb(a) for b, a in zip(before, after)}
    out = im.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a and (r, g, b) in table:
                px[x, y] = (*table[(r, g, b)], a)
    return out


def _rgb(hex_: str) -> tuple[int, int, int]:
    return tuple(int(hex_[i : i + 2], 16) for i in (1, 3, 5))


def building(middle_tiles: int, *, chimney: bool, roof_colors: list[str] | None = None) -> Image.Image:
    """앞에서 본 나무집 한 채. 위에서부터 지붕(5줄 조각 중 4줄) → 벽(2줄). 문은 아래 가운데, 창은 문 왼쪽.

    지붕 조각은 왼쪽 끝 5px + 가운데 16px 타일 반복 + 오른쪽 끝 5px다. 벽은 지붕 폭에 맞춰 늘린다.
    """
    roof_sheet = src("Tilesets/Wooden_House_Roof_Tilset.png")
    walls = src("Tilesets/Wooden_House_Walls_Tilset.png")
    doors = src("Tilesets/Doors.png")
    edge = 5
    w = edge + middle_tiles * T + edge
    top = T // 2 if chimney else 0  # 굴뚝이 지붕 위로 솟는 자리
    rows = (0, 2, 3, 4)  # 위 끝 · 들보 · 기와 · 아래 끝 (기와 한 줄을 빼서 지붕을 낮춘다)
    roof_h = 7 + 2 * T + 7  # 위 들쭉날쭉 7px + 가운데 2줄 + 아래 7px
    wall_top = top + roof_h - 5  # 지붕 끝이 벽 위를 살짝 덮는다
    im = Image.new("RGBA", (w, wall_top + 2 * T))

    # 벽: 바깥벽 2×2 조각(3,4 / 8,9)을 가로로 늘린다. 판자가 가로줄이라 가운데를 되풀이해도 이음매가 없다
    wall_piece = Image.new("RGBA", (2 * T, 2 * T))
    for i, idx in enumerate((3, 4, 8, 9)):
        wall_piece.alpha_composite(tile(walls, idx), (i % 2 * T, i // 2 * T))
    im.alpha_composite(stretch_x(wall_piece, w, 6, 6), (0, wall_top))

    # 문은 아래 줄 가운데, 창은 그 왼쪽
    bottom = wall_top + T
    door_x = (w - T) // 2
    im.alpha_composite(tile(doors, 1), (door_x, bottom))
    im.alpha_composite(tile(walls, 13), (door_x - T - 3, bottom))

    # 지붕: 가장자리 타일은 그림이 있는 5px만, 가운데 타일은 통째로 되풀이한다 (기와 무늬를 살리려고)
    roof = Image.new("RGBA", (w, len(rows) * T))
    for i, row in enumerate(rows):
        y = i * T
        left, mid, right = (tile(roof_sheet, row * 7 + c) for c in range(3))
        roof.alpha_composite(left.crop((T - edge, 0, T, T)), (0, y))
        for m in range(middle_tiles):
            roof.alpha_composite(mid, (edge + m * T, y))
        roof.alpha_composite(right.crop((0, 0, edge, T)), (w - edge, y))
    roof = roof.crop((0, 9, w, 9 + roof_h))  # 첫 줄 위 빈 9px를 잘라 낸다
    if roof_colors:
        roof = recolor(roof, ROOF, roof_colors)
    if chimney:
        im.alpha_composite(tile(roof_sheet, 5), (w - edge - T - 4, 0))
    im.alpha_composite(roof, (0, top))
    return im


def tileset_json(name: str, image: Image.Image, extra: dict | None = None) -> dict:
    data = {
        "type": "tileset",
        "version": "1.10",
        "tiledversion": "1.11.0",
        "name": name,
        "tilewidth": T,
        "tileheight": T,
        "image": f"{name}.png",
        "imagewidth": image.width,
        "imageheight": image.height,
        "columns": image.width // T,
        "tilecount": (image.width // T) * (image.height // T),
        "margin": 0,
        "spacing": 0,
    }
    data.update(extra or {})
    return data


def write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    if not SRC.is_dir():
        sys.exit(f"원본 팩이 없습니다: {SRC}\n받는 방법은 docs/research/village-assets.md 를 보세요")
    tilesets = OUT / "tilesets"
    tilesets.mkdir(parents=True, exist_ok=True)

    for name, rel in TILESETS.items():
        im = src(rel)
        im.save(tilesets / f"{name}.png")
        extra = None
        if name == "water":
            # 물결 4장을 0.25초씩 돈다
            extra = {"tiles": [{"id": 0, "animation": [{"tileid": i, "duration": 250} for i in range(4)]}]}
        write_json(tilesets / f"{name}.tsj", tileset_json(name, im, extra))

    # 걸을 수 없는 칸 표시용 (Tiled에서만 보이고 화면에는 그리지 않는다)
    block = Image.new("RGBA", (T, T), (217, 87, 99, 120))
    block.save(tilesets / "collision.png")
    write_json(tilesets / "collision.tsj", tileset_json("collision", block))

    # 건물: 그림 모음 타일셋 (Tiled에서 그림째로 놓는다)
    buildings = OUT / "buildings"
    buildings.mkdir(exist_ok=True)
    made = {
        "house": building(4, chimney=True),
        "shop": building(3, chimney=False, roof_colors=ROOF_SWAPS["shop"]),
        "lab": building(3, chimney=True, roof_colors=ROOF_SWAPS["lab"]),
    }
    tiles = []
    for i, (name, im) in enumerate(made.items()):
        im.save(buildings / f"{name}.png")
        tiles.append({"id": i, "image": f"../buildings/{name}.png", "imagewidth": im.width, "imageheight": im.height,
                      "properties": [{"name": "kind", "type": "string", "value": name}]})
    write_json(tilesets / "buildings.tsj", {
        "type": "tileset", "version": "1.10", "tiledversion": "1.11.0", "name": "buildings",
        "tilewidth": max(im.width for im in made.values()), "tileheight": max(im.height for im in made.values()),
        "columns": 0, "tilecount": len(tiles), "margin": 0, "spacing": 0,
        "grid": {"orientation": "orthogonal", "width": 1, "height": 1}, "tiles": tiles,
    })

    # 캐릭터: 48×48 칸, 4줄(아래·위·왼쪽·오른쪽) × 4칸(서 있기 2 + 걷기 2)
    sprites = OUT / "sprites"
    sprites.mkdir(exist_ok=True)
    shutil.copyfile(SRC / "Characters" / "Basic Charakter Spritesheet.png", sprites / "player-default.png")
    print(f"만들었습니다: {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
