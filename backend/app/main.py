"""서버 진입점. /api 아래는 API, 그 밖의 주소는 빌드된 화면(frontend/dist)을 돌려준다."""
import hashlib
import json
from datetime import date
from urllib.parse import quote

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from backend.app import excel
from backend.app.config import FRONTEND_DIST, data_dir
from backend.app.games import GameConflictError, GameIn, apply_patch, describe_error, new_game
from backend.app.store import DataFileCorruptedError, collection_lock, load_collection, save_collection

app = FastAPI(title="boardgame-home")


@app.exception_handler(DataFileCorruptedError)
def corrupted(_: Request, e: DataFileCorruptedError) -> JSONResponse:
    return JSONResponse({"detail": str(e)}, status_code=500)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "data_dir": str(data_dir())}


@app.exception_handler(RequestValidationError)
def invalid_input(_: Request, e: RequestValidationError) -> JSONResponse:
    # 화면에 그대로 보여 줄 한 줄: "별점: 5 이하여야 합니다"
    return JSONResponse({"detail": " / ".join(describe_error(err) for err in e.errors())}, status_code=422)


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


# ---------- 엑셀 ----------

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
MAX_UPLOAD = 5 * 1024 * 1024


def _version(games: list[dict]) -> str:
    """목록 내용의 지문. 미리보기 뒤에 목록이 바뀌었는지 알아보는 데 쓴다."""
    return hashlib.md5(json.dumps(games, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()


async def _read_upload(request: Request) -> bytes:
    data = await request.body()
    if not data:
        raise HTTPException(422, "파일이 비어 있습니다")
    if len(data) > MAX_UPLOAD:
        raise HTTPException(422, "파일이 너무 큽니다 (5MB까지)")
    return data


def _plan_upload(data: bytes, games: list[dict]) -> tuple[list[dict], dict]:
    try:
        return excel.plan_import(games, excel.read_workbook(data))
    except excel.ExcelReadError as e:
        raise HTTPException(422, str(e)) from e


@app.get("/api/excel")
def download_excel(only: str | None = None) -> Response:
    """only=blanks면 빈칸(인원·시간·정가)이 있는 게임만"""
    if only not in (None, "blanks"):
        raise HTTPException(422, "only는 blanks만 쓸 수 있습니다")
    today = date.today()
    name = f"내보드게임_{'빈칸_' if only else ''}{today:%Y%m%d}.xlsx"
    return Response(
        excel.build_workbook(load_collection(), today, only_blanks=only == "blanks"),
        media_type=XLSX,
        # 한글 파일 이름은 filename*로, 옛 브라우저용 filename은 영어로
        headers={"Content-Disposition": f"attachment; filename=\"boardgame_{today:%Y%m%d}.xlsx\"; filename*=UTF-8''{quote(name)}"},
    )


@app.post("/api/excel/preview")
async def preview_excel(request: Request) -> dict:
    data = await _read_upload(request)
    games = load_collection()
    _, report = _plan_upload(data, games)
    return {"base": _version(games), "report": report}


@app.post("/api/excel/apply")
async def apply_excel(request: Request, base: str) -> dict:
    # 파일을 다 받은 뒤에 잠근다 (기다리는 동안 잠금을 쥐고 있지 않게)
    data = await _read_upload(request)
    with collection_lock():
        games = load_collection()
        if _version(games) != base:
            raise HTTPException(409, "미리보기 뒤에 목록이 바뀌었습니다. 엑셀을 다시 올려 미리보기부터 해 주세요")
        new_games, report = _plan_upload(data, games)
        if report["errors"]:
            raise HTTPException(422, "오류가 있는 행이 있어 적용하지 않았습니다. 엑셀을 고쳐 다시 올려 주세요")
        if report["changes"]:
            save_collection(new_games)
    return {"report": report}


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
