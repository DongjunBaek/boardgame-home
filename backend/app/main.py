"""서버 진입점. /api 아래는 API, 그 밖의 주소는 빌드된 화면(frontend/dist)을 돌려준다."""
import hashlib
import json
import re
import secrets
from datetime import date, datetime
from urllib.parse import quote

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from backend.app import club, excel, ledger, village
from backend.app.config import FRONTEND_DIST, data_dir
from backend.app.games import GameConflictError, GameIn, apply_patch, describe_error, new_game
from backend.app.store import DataFileCorruptedError, collection_lock, load_collection, load_json, load_object, save_collection, save_json
from backend.app.stores import STORES_FILE, StoreConflictError, StoreIn, apply_store_patch, new_store, seed_stores

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
@app.exception_handler(StoreConflictError)
@app.exception_handler(club.ClubConflictError)
def conflict(_: Request, e: Exception) -> JSONResponse:
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


# ---------- 스토어 바로가기 ----------


def _load_stores() -> list[dict]:
    """처음에는 보유 게임의 판매 링크로 목록을 만들어 저장한다. 잠금 안에서 부른다."""
    stores = load_json(STORES_FILE)
    if stores is None:
        stores = seed_stores(load_collection())
        save_json(STORES_FILE, stores)
    return stores


@app.get("/api/stores")
def list_stores() -> list[dict]:
    with collection_lock():
        return _load_stores()


@app.post("/api/stores", status_code=201)
def create_store(data: StoreIn) -> dict:
    with collection_lock():
        stores = _load_stores()
        try:
            store = new_store(stores, data)
        except ValueError as e:
            raise HTTPException(422, str(e)) from e
        save_json(STORES_FILE, [*stores, store])
    return store


@app.patch("/api/stores/{store_id}")
def update_store(store_id: str, patch: StoreIn) -> dict:
    with collection_lock():
        try:
            stores = apply_store_patch(_load_stores(), store_id, patch)
        except KeyError as e:
            raise HTTPException(404, f"없는 스토어입니다: {store_id}") from e
        save_json(STORES_FILE, stores)
    return next(s for s in stores if s["id"] == store_id)


@app.delete("/api/stores/{store_id}", status_code=204)
def delete_store(store_id: str) -> Response:
    with collection_lock():
        stores = _load_stores()
        rest = [s for s in stores if s["id"] != store_id]
        if len(rest) == len(stores):
            raise HTTPException(404, f"없는 스토어입니다: {store_id}")
        save_json(STORES_FILE, rest)
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


# ---------- 동아리 회비 ----------


def _club_tiers() -> list[dict]:
    """처음에는 기본 구분(정회원·준회원·면제)을 만들어 저장한다. 잠금 안에서 부른다."""
    tiers = load_json(club.TIERS_FILE)
    if tiers is None:
        tiers = club.seed_tiers()
        save_json(club.TIERS_FILE, tiers)
    return tiers


def _club_list(name: str) -> list[dict]:
    return load_json(name) or []


@app.get("/api/club")
def get_club() -> dict:
    # 회원 20명 정도라 한 번에 다 보낸다
    with collection_lock():
        return {
            "tiers": _club_tiers(),
            "members": _club_list(club.MEMBERS_FILE),
            "payments": _club_list(club.PAYMENTS_FILE),
            "ledger": _club_list(ledger.LEDGER_FILE),
        }


@app.post("/api/club/tiers", status_code=201)
def create_tier(data: club.TierIn) -> dict:
    with collection_lock():
        tiers = _club_tiers()
        try:
            tier = club.new_tier(tiers, data)
        except ValueError as e:
            raise HTTPException(422, str(e)) from e
        save_json(club.TIERS_FILE, [*tiers, tier])
    return tier


@app.patch("/api/club/tiers/{tier_id}")
def update_tier(tier_id: str, patch: club.TierIn) -> dict:
    with collection_lock():
        try:
            tiers = club.apply_tier_patch(_club_tiers(), tier_id, patch)
        except KeyError as e:
            raise HTTPException(404, f"없는 구분입니다: {tier_id}") from e
        save_json(club.TIERS_FILE, tiers)
    return next(t for t in tiers if t["id"] == tier_id)


@app.delete("/api/club/tiers/{tier_id}", status_code=204)
def delete_tier(tier_id: str) -> Response:
    with collection_lock():
        tiers = _club_tiers()
        rest = [t for t in tiers if t["id"] != tier_id]
        if len(rest) == len(tiers):
            raise HTTPException(404, f"없는 구분입니다: {tier_id}")
        club.check_tier_unused(_club_list(club.MEMBERS_FILE), tier_id)
        save_json(club.TIERS_FILE, rest)
    return Response(status_code=204)


@app.post("/api/club/members", status_code=201)
def create_member(data: club.MemberIn) -> dict:
    with collection_lock():
        members = _club_list(club.MEMBERS_FILE)
        try:
            member = club.new_member(members, _club_tiers(), data)
        except ValueError as e:
            raise HTTPException(422, str(e)) from e
        save_json(club.MEMBERS_FILE, [*members, member])
    return member


@app.patch("/api/club/members/{member_id}")
def update_member(member_id: str, patch: club.MemberIn) -> dict:
    with collection_lock():
        try:
            members = club.apply_member_patch(_club_list(club.MEMBERS_FILE), _club_tiers(), member_id, patch)
        except KeyError as e:
            raise HTTPException(404, f"없는 회원입니다: {member_id}") from e
        except ValueError as e:
            raise HTTPException(422, str(e)) from e
        save_json(club.MEMBERS_FILE, members)
    return next(m for m in members if m["id"] == member_id)


@app.delete("/api/club/members/{member_id}", status_code=204)
def delete_member(member_id: str) -> Response:
    with collection_lock():
        members = _club_list(club.MEMBERS_FILE)
        rest = [m for m in members if m["id"] != member_id]
        if len(rest) == len(members):
            raise HTTPException(404, f"없는 회원입니다: {member_id}")
        club.check_member_removable(_club_list(club.PAYMENTS_FILE), member_id)
        save_json(club.MEMBERS_FILE, rest)
    return Response(status_code=204)


def _check_month(month: str) -> None:
    if not re.match(club.MONTH_PATTERN, month):
        raise HTTPException(422, f"달 형식이 아닙니다 (예: 2026-10): {month}")


@app.put("/api/club/payments/{member_id}/{month}")
def put_payment(member_id: str, month: str, data: club.PaymentIn) -> list[dict]:
    _check_month(month)
    with collection_lock():
        try:
            payments, written = club.put_payments(
                _club_list(club.PAYMENTS_FILE), _club_list(club.MEMBERS_FILE), member_id, month, data
            )
        except KeyError as e:
            raise HTTPException(404, f"없는 회원입니다: {member_id}") from e
        except ValueError as e:
            raise HTTPException(422, str(e)) from e
        save_json(club.PAYMENTS_FILE, payments)
    return written


@app.delete("/api/club/payments/{member_id}/{month}", status_code=204)
def delete_payment(member_id: str, month: str) -> Response:
    _check_month(month)
    with collection_lock():
        try:
            payments = club.remove_payment(_club_list(club.PAYMENTS_FILE), member_id, month)
        except KeyError as e:
            raise HTTPException(404, f"기록이 없습니다: {month}") from e
        save_json(club.PAYMENTS_FILE, payments)
    return Response(status_code=204)


# ---------- 회계록 ----------


@app.post("/api/club/ledger", status_code=201)
def create_entry(data: ledger.EntryIn) -> dict:
    with collection_lock():
        try:
            entries, entry = ledger.add_entry(_club_list(ledger.LEDGER_FILE), data)
        except ValueError as e:
            raise HTTPException(422, str(e)) from e
        save_json(ledger.LEDGER_FILE, entries)
    return entry


@app.patch("/api/club/ledger/{entry_id}")
def update_entry(entry_id: str, patch: ledger.EntryIn) -> dict:
    with collection_lock():
        try:
            entries = ledger.apply_entry_patch(_club_list(ledger.LEDGER_FILE), entry_id, patch)
        except KeyError as e:
            raise HTTPException(404, f"없는 기록입니다: {entry_id}") from e
        save_json(ledger.LEDGER_FILE, entries)
    return next(e for e in entries if e["id"] == entry_id)


@app.delete("/api/club/ledger/{entry_id}", status_code=204)
def delete_entry(entry_id: str) -> Response:
    with collection_lock():
        entries = _club_list(ledger.LEDGER_FILE)
        rest = [e for e in entries if e["id"] != entry_id]
        if len(rest) == len(entries):
            raise HTTPException(404, f"없는 기록입니다: {entry_id}")
        save_json(ledger.LEDGER_FILE, rest)
    return Response(status_code=204)


# ---------- 대시보드 마을 ----------


def _now() -> datetime:
    """테스트가 시각을 바꿔 끼울 수 있게 한곳에서 읽는다."""
    return datetime.now()


def _village() -> dict:
    """처음 열 때 기본 상태를 만들어 저장한다. 잠금 안에서 부른다."""
    stored = load_object(village.VILLAGE_FILE)
    state = village.normalize(stored, _now())
    if stored is None:
        save_json(village.VILLAGE_FILE, state)
    return state


@app.get("/api/village")
def get_village() -> dict:
    with collection_lock():
        return village.view(_village(), _now())


@app.put("/api/village/player")
def put_village_player(data: village.PlayerIn) -> dict:
    with collection_lock():
        before = _village()
        state = village.set_player(before, data)
        # 제자리면 쓰지 않는다 (저장할 때마다 백업이 하나씩 생기므로)
        if state != before:
            save_json(village.VILLAGE_FILE, state)
    return village.view(state, _now())


@app.post("/api/village/harvest")
def harvest_village() -> dict:
    """밭에 쌓인 코인을 거둔다. 거둘 것이 없으면 아무것도 바꾸지 않고 harvested 0을 돌려준다."""
    now = _now()
    with collection_lock():
        state, got = village.harvest(_village(), now)
        if got:
            save_json(village.VILLAGE_FILE, state)
    return {"harvested": got, "village": village.view(state, now)}


@app.post("/api/village/research")
def research_village() -> dict:
    """작물 레벨을 하나 올린다. 밭에 쌓인 코인은 옛 레벨로 먼저 거둔다."""
    now = _now()
    with collection_lock():
        try:
            state, harvested, cost = village.research(_village(), now)
        except village.ResearchError as e:
            raise HTTPException(409, str(e)) from e
        save_json(village.VILLAGE_FILE, state)
    return {"harvested": harvested, "cost": cost, "village": village.view(state, now)}


@app.post("/api/village/gacha")
def gacha_village() -> dict:
    """상점 뽑기 한 번. 결과는 서버가 정한다 (화면에서 정하면 조작할 수 있어서)."""
    with collection_lock():
        try:
            state, result = village.gacha(_village(), secrets.SystemRandom())
        except village.GachaError as e:
            raise HTTPException(409, str(e)) from e
        save_json(village.VILLAGE_FILE, state)
    return {"result": result, "village": village.view(state, _now())}


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
        # index.html은 매번 새로 확인하게 한다 (빌드 뒤에 옛 화면이 남지 않게). assets/는 이름에 해시가 있어 괜찮다
        return FileResponse(FRONTEND_DIST / "index.html", headers={"Cache-Control": "no-cache"})
