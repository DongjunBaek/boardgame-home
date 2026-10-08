"""서버 진입점. /api 아래는 API, 그 밖의 주소는 빌드된 화면(frontend/dist)을 돌려준다."""
from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.app.config import FRONTEND_DIST, data_dir

app = FastAPI(title="boardgame-home")


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "data_dir": str(data_dir())}


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
