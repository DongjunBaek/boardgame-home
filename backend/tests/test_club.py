from fastapi.testclient import TestClient

from backend.app import club, store
from backend.app.main import app

client = TestClient(app)


def tiers():
    return client.get("/api/club").json()["tiers"]


def add_member(name="김철수", joined="2026-01", **extra):
    tier = tiers()[0]["id"]
    res = client.post("/api/club/members", json={"name": name, "tier_id": tier, "joined": joined, **extra})
    assert res.status_code == 201, res.text
    return res.json()


def test_next_month():
    assert club.next_month("2026-11", 1) == "2026-12"
    assert club.next_month("2026-12", 1) == "2027-01"
    assert club.next_month("2026-01", 14) == "2027-03"


def test_first_get_seeds_default_tiers_once(isolated_data_dir):
    first = client.get("/api/club").json()
    assert [t["name"] for t in first["tiers"]] == ["정회원", "준회원", "면제"]
    assert first["tiers"][2]["exempt"] is True
    assert first["members"] == [] and first["payments"] == []
    assert client.get("/api/club").json()["tiers"] == first["tiers"]
    assert (isolated_data_dir / club.TIERS_FILE).exists()


def test_tier_crud_and_rules():
    res = client.post("/api/club/tiers", json={"name": "학생", "monthly_fee": 5000})
    assert res.status_code == 201
    tid = res.json()["id"]
    assert res.json()["exempt"] is False
    assert client.post("/api/club/tiers", json={"name": "학생"}).status_code == 409
    assert client.patch(f"/api/club/tiers/{tid}", json={"monthly_fee": -1}).status_code == 422
    assert client.patch(f"/api/club/tiers/{tid}", json={"monthly_fee": 6000}).json()["monthly_fee"] == 6000
    assert client.patch("/api/club/tiers/tier:none", json={"monthly_fee": 1}).status_code == 404
    # 쓰는 회원이 있으면 못 지운다
    client.post("/api/club/members", json={"name": "a", "tier_id": tid, "joined": "2026-01"})
    res = client.delete(f"/api/club/tiers/{tid}")
    assert res.status_code == 409 and "a" in res.json()["detail"]


def test_member_create_and_validation():
    m = add_member()
    assert m["status"] == "active" and m["status_since"] is None
    assert client.post("/api/club/members", json={"name": "x", "tier_id": "tier:none", "joined": "2026-01"}).status_code == 422
    assert client.post("/api/club/members", json={"name": "x", "tier_id": m["tier_id"], "joined": "2026-13"}).status_code == 422
    assert client.post("/api/club/members", json={"name": "x", "tier_id": m["tier_id"]}).status_code == 422
    # 활동 중인 같은 이름은 안 된다
    assert client.post("/api/club/members", json={"name": "김철수", "tier_id": m["tier_id"], "joined": "2026-02"}).status_code == 409


def test_member_status_needs_since_and_clears_when_active():
    m = add_member(joined="2026-03")
    path = f"/api/club/members/{m['id']}"
    assert client.patch(path, json={"status": "left"}).status_code == 422
    assert client.patch(path, json={"status": "left", "status_since": "2026-02"}).status_code == 422
    left = client.patch(path, json={"status": "left", "status_since": "2026-06"}).json()
    assert left["status"] == "left" and left["status_since"] == "2026-06"
    # 탈퇴한 사람과는 이름이 같아도 된다
    add_member(joined="2026-07")
    back = client.patch(path, json={"status": "active"})
    assert back.status_code == 409  # 다시 활동하면 이름이 겹친다


def test_payment_put_overwrite_multi_month_and_delete():
    m = add_member()
    base = f"/api/club/payments/{m['id']}"
    assert client.put(f"{base}/2026-01", json={"kind": "paid"}).status_code == 422  # 금액 없음
    one = client.put(f"{base}/2026-01", json={"amount": 10000, "paid_on": "2026-01-05", "method": "bank"}).json()
    assert one == [{"member_id": m["id"], "month": "2026-01", "kind": "paid", "amount": 10000,
                    "paid_on": "2026-01-05", "method": "bank", "memo": None}]
    # 같은 칸은 덮어쓴다
    client.put(f"{base}/2026-01", json={"amount": 8000})
    # 석 달 치 한 번에
    three = client.put(f"{base}/2026-11", json={"amount": 10000, "months": 3}).json()
    assert [p["month"] for p in three] == ["2026-11", "2026-12", "2027-01"]
    # 이어지는 달에 기록이 있으면 거절
    assert client.put(f"{base}/2026-10", json={"amount": 1, "months": 2}).status_code == 409
    exempt = client.put(f"{base}/2026-02", json={"kind": "exempt", "amount": 5000, "method": "cash"}).json()[0]
    assert exempt["amount"] is None and exempt["method"] is None
    payments = client.get("/api/club").json()["payments"]
    assert [(p["month"], p["amount"]) for p in payments] == [
        ("2026-01", 8000), ("2026-02", None), ("2026-11", 10000), ("2026-12", 10000), ("2027-01", 10000)]
    assert client.delete(f"{base}/2026-02").status_code == 204
    assert client.delete(f"{base}/2026-02").status_code == 404
    assert client.put(f"{base}/2026-1", json={"amount": 1}).status_code == 422
    assert client.put("/api/club/payments/member:none/2026-01", json={"amount": 1}).status_code == 404


def test_member_with_payments_cannot_be_deleted():
    m = add_member()
    client.put(f"/api/club/payments/{m['id']}/2026-01", json={"amount": 1})
    assert client.delete(f"/api/club/members/{m['id']}").status_code == 409
    fresh = add_member(name="잘못 만든 회원")
    assert client.delete(f"/api/club/members/{fresh['id']}").status_code == 204


def test_saves_make_backups(isolated_data_dir):
    m = add_member()
    client.put(f"/api/club/payments/{m['id']}/2026-01", json={"amount": 1})
    client.put(f"/api/club/payments/{m['id']}/2026-02", json={"amount": 1})
    assert list((isolated_data_dir / store.BACKUP_DIR).glob("club_payments-*.json"))
