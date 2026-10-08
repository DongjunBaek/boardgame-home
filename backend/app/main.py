"""서버 진입점. /api 아래는 API, 그 밖의 주소는 빌드된 화면(frontend/dist)을 돌려준다."""
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from backend.app.config import FRONTEND_DIST, data_dir
from backend.app.games import GameConflictError, GameIn, apply_patch, new_game
from backend.app.store import DataFileCorruptedError, collection_lock, load_collection, save_collection

app = FastAPI(title="boardgame-home")


@app.exception_handler(DataFileCorruptedError)
def corrupted(_: Request, e: DataFileCorruptedError) -> JSONResponse:
    return JSONResponse({"detail": str(e)}, status_code=500)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "data_dir": str(data_dir())}


FIELD_LABELS = {
    "title": "제목", "genres": "장르", "player_count": "인원", "play_time_minutes": "시간", "price": "정가",
    "publisher": "제작사", "sale_link": "판매 링크", "images": "이미지", "tags": "태그", "quantity": "개수",
    "played": "해봤음", "rating": "별점", "review": "후기", "notes": "메모", "date": "구입일", "paid": "낸 가격",
    "shop": "산 곳",
}


@app.exception_handler(RequestValidationError)
def invalid_input(_: Request, e: RequestValidationError) -> JSONResponse:
    # 화면에 그대로 보여 줄 한 줄: "별점: Input should be less than or equal to 5"
    parts = []
    for err in e.errors():
        field = next((str(x) for x in reversed(err["loc"]) if isinstance(x, str) and x != "body"), "")
        msg = err["msg"].removeprefix("Value error, ")
        parts.append(f"{FIELD_LABELS.get(field, field)}: {msg}" if field else msg)
    return JSONResponse({"detail": " / ".join(parts)}, status_code=422)


@app.exception_handler(GameConflictError)
def conflict(_: Request, e: GameConflictError) -> JSONResponse:
    return JSONResponse({"detail": str(e)}, status_code=409)


@app.get("/api/games")
def list_games() -> list[dict]:
    # 99개 정도라 거르기·정렬은 화면에서 한다
    return load_collection()


@app.post("/api/games", status_code=201)
def create_game(data: GameIn) -> dict:
    with collection_lock():
        games = load_collection()
        try:
            game = new_game(games, data)
        except ValueError as e:
            raise HTTPException(422, str(e)) from e
        save_collection([*games, game])
    return game


@app.patch("/api/games/{game_id}")
def update_game(game_id: str, patch: GameIn) -> dict:
    with collection_lock():
        try:
            games = apply_patch(load_collection(), game_id, patch)
        except KeyError as e:
            raise HTTPException(404, f"없는 게임입니다: {game_id}") from e
        save_collection(games)
    return next(g for g in games if g["id"] == game_id)


@app.delete("/api/games/{game_id}", status_code=204)
def delete_game(game_id: str) -> Response:
    with collection_lock():
        games = load_collection()
        rest = [g for g in games if g["id"] != game_id]
        if len(rest) == len(games):
            raise HTTPException(404, f"없는 게임입니다: {game_id}")
        save_collection(rest)
    return Response(status_code=204)


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
def api_not_found(path: str) -> JSONResponse:
    # 없는 API 주소가 화면(index.html)으로 빠지지 않게 막는다
    return JSONResponse({"detail": "Not Found"}, status_code=404)


if FRONTEND_DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        file = FRONTEND_DIST / path
        if path and file.is_file() and FRONTEND_DIST in file.resolve().parents:
            return FileResponse(file)
        return FileResponse(FRONTEND_DIST / "index.html")
