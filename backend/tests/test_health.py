import pytest
from fastapi.testclient import TestClient

from backend.app.config import FRONTEND_DIST
from backend.app.main import app

client = TestClient(app)


def test_health_uses_isolated_data_dir(isolated_data_dir):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "data_dir": str(isolated_data_dir)}


def test_unknown_api_is_404():
    assert client.get("/api/nope").status_code == 404


@pytest.mark.skipif(not (FRONTEND_DIST / "index.html").exists(), reason="화면이 빌드되지 않음")
def test_index_html_is_not_cached():
    res = client.get("/")
    assert res.headers["cache-control"] == "no-cache"
