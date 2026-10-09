"""마을 그림 만들기: assets-src/village/sprout-lands(원본 팩) → frontend/public/village(앱이 읽는 그림).

- 원본 팩은 저장소에 올리지 않는다(.gitignore). 다시 받으면 같은 자리에 풀고 이 스크립트를 돌린다.
- 타일셋은 그대로 복사하고, Tiled 타일셋 정보(.tsj)를 만든다.
- 건물(집·상점·연구소)은 지붕·벽·문 조각을 이어 붙여 한 장짜리 그림으로 만든다.
  상점·연구소 지붕은 팩 팔레트 안에서 색만 바꾼다(다른 색을 섞지 않으려고).
- 지도(maps/*.tmj)는 만들지 않는다. Tiled에서 고친 것을 덮어쓰지 않게 따로 둔다.

실행: python scripts/build_village_assets.py  (Pillow가 필요하다: pip install pillow. 서버 .venv에는 넣지 않는다)
"""
import json
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
    # 집 안: 방 벽·바닥, 창 있는 벽, 문
    "walls": "Tilesets/Wooden_House_Walls_Tilset.png",
    "room": "Tilesets/Wooden House.png",
    "doors": "Tilesets/Doors.png",
}

# 작물: 줄마다 씨앗 봉투 · 자라는 4단계 · 거둔 열매. 1줄 밀(LV1), 2줄 분홍 열매(LV2), 3줄은 2줄의 열매 색을 바꾼 파란 열매(LV3)
BERRY = ["#713970", "#8a4a70", "#a35b70", "#af6776", "#bd757e", "#d99a9a"]
BLUEBERRY = ["#4c468b", "#555793", "#5f699c", "#7180b1", "#8599c7", "#92b2d4"]

# 지붕 색 = 건물 스킨. 원래 지붕 갈색 5단계 → 팔레트의 다른 5단계 (어두운 것부터)
# id는 서버(backend/app/village.py의 ROOFS)와 같아야 한다
ROOF = ["#754c60", "#90625d", "#aa7959", "#b68962", "#c49a6c"]
ROOFS = {
    "wood": ROOF,
    "rose": ["#713970", "#8a4a70", "#a35b70", "#af6776", "#bd757e"],
    "teal": ["#505e77", "#5f7a79", "#6e967c", "#82a884", "#97bb8e"],
    "slate": ["#4c468b", "#555793", "#5f699c", "#7180b1", "#8599c7"],
    "gold": ["#795e53", "#957a4b", "#b09643", "#bfa954", "#d4c169"],
    "plum": ["#583f83", "#694a87", "#7b568c", "#90689f", "#a77bb3"],
}
# 건물마다 처음 지붕
DEFAULT_ROOF = {"house": "wood", "shop": "rose", "lab": "teal"}
BUILDING_SHAPE = {"house": (4, True), "shop": (3, False), "lab": (3, True)}  # (가운데 타일 수, 굴뚝)

# 캐릭터 스킨: 몸 · 무늬 · 목걸이 색을 바꾼다 (외곽선·볼·방울은 그대로). id는 서버의 PLAYER_SKINS와 같다
PLAYER_BASE = ["#f3f2c0", "#ddd5de", "#766daa"]
PLAYER_SKINS = {
    "default": PLAYER_BASE,
    "brown": ["#dcb98a", "#c49a6c", "#67835c"],
    "gray": ["#c1c8b9", "#9da89a", "#a35b70"],
    "black": ["#6b7470", "#545959", "#eeba77"],
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


# 아이콘: 팩에 없어서 팩 팔레트 색으로 직접 찍는다 (16×16). 글자 하나가 픽셀 하나
ICONS = {
    "coin": (
        {"o": "#865161", "d": "#ba7c54", "m": "#d79e61", "l": "#f2cf8c", "w": "#f7ebaa"},
        [
            "................",
            "................",
            ".....oooooo.....",
            "....ommmmmmo....",
            "...omllllllmo...",
            "..omlwwlllllmo..",
            "..omlwlmmmllmo..",
            "..omllmllmllmo..",
            "..omllmllmllmo..",
            "..omllmmmdllmo..",
            "..omlllllllldo..",
            "...omlllllldo...",
            "....oddddddo....",
            ".....oooooo.....",
            "................",
            "................",
        ],
    ),
    "crystal": (
        {"o": "#4c468b", "d": "#7180b1", "m": "#92b2d4", "l": "#cbe0de", "w": "#f3f4e7"},
        [
            "................",
            "................",
            "....oooooooo....",
            "...owwllmmmdo...",
            "..owllllmmmmdo..",
            ".oooooooooooooo.",
            ".olllmmmmmmmddo.",
            "..ollmmmmmmddo..",
            "...olmmmmmddo...",
            "....olmmmddo....",
            ".....olmddo.....",
            "......oldo......",
            ".......oo.......",
            "................",
            "................",
            "................",
        ],
    ),
}


# 뽑기 가구: Basic Furniture.png에서 잘라 낼 범위 (x0, y0, x1, y1). 범위 안에서 그림이 있는 곳만 남긴다.
# 이름·확률은 서버(backend/app/village.py의 FURNITURE)에 있고, id가 같아야 한다 (테스트가 검사한다)
FURNITURE = {
    "painting-flowers": (0, 4, 17, 14),
    "painting-field": (18, 4, 31, 14),
    "painting-night": (34, 4, 48, 14),
    "pot-sunflower": (50, 0, 63, 15),
    "pot-sprout": (66, 0, 78, 14),
    "pot-blue-flower": (82, 0, 94, 14),
    "lamp-green": (50, 15, 63, 28),
    "lamp-blue": (66, 15, 78, 28),
    "lamp-pink": (82, 15, 94, 28),
    "bed-green": (0, 25, 16, 49),
    "bed-blue": (16, 25, 32, 49),
    "bed-pink": (32, 25, 48, 49),
    "dresser": (48, 31, 64, 48),
    "table": (48, 48, 64, 64),
    "chair": (66, 32, 78, 47),
    "cabinet": (98, 32, 110, 47),
    "side-table": (114, 35, 126, 47),
    "stool": (66, 50, 78, 61),
    "clock-cat": (80, 47, 95, 64),
    "clock-round": (97, 49, 112, 64),
    "clock-small": (115, 51, 126, 62),
    "rug-small-green": (0, 81, 16, 96),
    "rug-small-pink": (16, 81, 32, 96),
    "rug-small-blue": (32, 81, 48, 96),
    "rug-green": (51, 81, 77, 96),
    "rug-pink": (83, 81, 109, 96),
    "rug-blue": (115, 81, 141, 96),
}


# 책장: 팩에 없어서 서랍장 색으로 직접 그린다 (64×32, 두 칸). 책 등은 화면이 게임 목록으로 그린다.
# 칸 안쪽 자리는 frontend/src/lib/village/scene.ts의 SHELF와 같아야 한다
BOOKSHELF = {"outline": "#754c60", "wood": "#b68962", "light": "#dcb98a", "board": "#c49a6c", "back": "#90625d"}
SHELF_ROWS = [(3, 15), (18, 30)]  # 칸마다 (위 y, 아래 y). 안쪽 x는 3~61


def bookshelf() -> Image.Image:
    from PIL import ImageDraw

    c = {k: _rgb(v) for k, v in BOOKSHELF.items()}
    im = Image.new("RGBA", (64, 32))
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, 63, 31), fill=c["wood"], outline=c["outline"])
    d.line((1, 1, 62, 1), fill=c["light"])
    for top, bottom in SHELF_ROWS:
        d.rectangle((3, top, 60, bottom - 1), fill=c["back"])
        d.line((2, bottom, 61, bottom), fill=c["board"])
        d.line((2, bottom + 1, 61, bottom + 1), fill=c["outline"])
    return im


def icon(colors: dict[str, str], rows: list[str]) -> Image.Image:
    im = Image.new("RGBA", (T, T))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in colors:
                im.putpixel((x, y), (*_rgb(colors[ch]), 255))
    return im


def crops_with_lv3(im: Image.Image) -> Image.Image:
    out = Image.new("RGBA", (im.width, im.height + T))
    out.alpha_composite(im, (0, 0))
    out.alpha_composite(recolor(im.crop((0, T, im.width, 2 * T)), BERRY, BLUEBERRY), (0, im.height))
    return out


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
        if name == "crops":
            im = crops_with_lv3(im)
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
    made = {}
    for kind, (middle, chimney) in BUILDING_SHAPE.items():
        for roof, colors in ROOFS.items():
            im = building(middle, chimney=chimney, roof_colors=None if roof == "wood" else colors)
            im.save(buildings / f"{kind}-{roof}.png")  # 스킨: 건물-지붕.png
        made[kind] = building(middle, chimney=chimney, roof_colors=None if DEFAULT_ROOF[kind] == "wood" else ROOFS[DEFAULT_ROOF[kind]])
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
    sheet = src("Characters/Basic Charakter Spritesheet.png")
    for skin, colors in PLAYER_SKINS.items():
        (sheet if skin == "default" else recolor(sheet, PLAYER_BASE, colors)).save(sprites / f"player-{skin}.png")
    # 집 안 가구: 그림 모음 타일셋 (뽑기 가구 그림 + 책장). 지도에 그림째로 놓는다
    items = OUT / "items"
    items.mkdir(exist_ok=True)
    bookshelf().save(items / "bookshelf.png")
    furniture_tiles = []
    sheet = src("Objects/Basic Furniture.png")
    for i, item_id in enumerate([*FURNITURE, "bookshelf"]):
        path = items / f"{item_id}.png"
        if item_id != "bookshelf":
            part = sheet.crop(FURNITURE[item_id])
            part.crop(part.getbbox()).save(path)
        im = Image.open(path)
        furniture_tiles.append({"id": i, "image": f"../items/{item_id}.png", "imagewidth": im.width, "imageheight": im.height,
                                "properties": [{"name": "item", "type": "string", "value": item_id}]})
    write_json(tilesets / "furniture.tsj", {
        "type": "tileset", "version": "1.10", "tiledversion": "1.11.0", "name": "furniture",
        "tilewidth": 64, "tileheight": 32, "columns": 0, "tilecount": len(furniture_tiles), "margin": 0, "spacing": 0,
        "grid": {"orientation": "orthogonal", "width": 1, "height": 1}, "tiles": furniture_tiles,
    })

    icons = OUT / "icons"
    icons.mkdir(exist_ok=True)
    for name, (colors, rows) in ICONS.items():
        icon(colors, rows).save(icons / f"{name}.png")
    # 뽑기 상자: Chest.png 첫 줄(48×48 칸)의 닫힌 것과 열린 것.
    # 칸 안 그림이 작아서 두 장 모두 그림이 있는 곳(열린 뚜껑까지)만 같은 크기(18×21)로 자른다
    chest = src("Objects/Chest.png")
    box = (15, 11, 33, 32)
    chest.crop(box).save(icons / "chest-closed.png")
    chest.crop((4 * 48 + box[0], box[1], 4 * 48 + box[2], box[3])).save(icons / "chest-open.png")
    print(f"만들었습니다: {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
