from fastapi.testclient import TestClient

from backend.app import ledger
from backend.app.main import app

client = TestClient(app)


def add(**body):
    base = {"date": "2026-10-01", "kind": "out", "amount": 30000, "description": "간식"}
    return client.post("/api/club/ledger", json={**base, **body})


def test_get_club_includes_empty_ledger():
    assert client.get("/api/club").json()["ledger"] == []


def test_create_validates_and_sorts_by_date(isolated_data_dir):
    res = add(category=" 간식·식비 ", memo="  ")
    assert res.status_code == 201
    e = res.json()
    assert e["id"].startswith("entry:") and e["category"] == "간식·식비" and e["memo"] is None
    add(date="2026-09-15", kind="in", amount=50000, description="후원")
    assert [x["date"] for x in client.get("/api/club").json()["ledger"]] == ["2026-09-15", "2026-10-01"]
    assert (isolated_data_dir / ledger.LEDGER_FILE).exists()
    assert add(amount=0).status_code == 422
    assert add(kind="transfer").status_code == 422
    assert add(description=" ").status_code == 422
    assert add(date="2026-13-01").status_code == 422
    assert client.post("/api/club/ledger", json={"kind": "in", "amount": 1, "description": "x"}).status_code == 422


def test_patch_and_delete():
    eid = add().json()["id"]
    path = f"/api/club/ledger/{eid}"
    got = client.patch(path, json={"amount": 25000, "date": "2026-10-03"}).json()
    assert got["amount"] == 25000 and got["date"] == "2026-10-03" and got["description"] == "간식"
    assert client.patch(path, json={"amount": None}).status_code == 422
    assert client.patch("/api/club/ledger/entry:none", json={"amount": 1}).status_code == 404
    assert client.delete(path).status_code == 204
    assert client.delete(path).status_code == 404
