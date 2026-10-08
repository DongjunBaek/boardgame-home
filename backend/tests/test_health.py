from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


def test_health_uses_isolated_data_dir(isolated_data_dir):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "data_dir": str(isolated_data_dir)}


def test_unknown_api_is_404():
    assert client.get("/api/nope").status_code == 404
