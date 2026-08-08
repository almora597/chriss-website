"""Iteration 2 tests: editable hours + manage-my-booking token flow.
Reuses the pytest fixtures (admin_token, client, mongo_db) from backend_test.py via conftest.
"""
import os
import uuid
import pytest
import requests
from datetime import date, timedelta, datetime, timezone
from pathlib import Path
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(Path("/app/backend/.env"))

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE_URL:
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL"):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
ADMIN_EMAIL = "z6md2dmmvg@privaterelay.appleid.com"

DEFAULT_HOURS = {
    "0": {"closed": False, "open": 8, "close": 17, "slot": 60},
    "1": {"closed": False, "open": 8, "close": 17, "slot": 60},
    "2": {"closed": False, "open": 8, "close": 17, "slot": 60},
    "3": {"closed": False, "open": 8, "close": 17, "slot": 60},
    "4": {"closed": False, "open": 8, "close": 17, "slot": 60},
    "5": {"closed": False, "open": 8, "close": 18, "slot": 30},
    "6": {"closed": True, "open": 8, "close": 17, "slot": 60},
}


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def mongo_db():
    return MongoClient(MONGO_URL)[DB_NAME]


@pytest.fixture(scope="module")
def admin_token(mongo_db):
    token = f"test_session_{uuid.uuid4().hex}"
    user_id = f"user_test_{uuid.uuid4().hex[:8]}"
    mongo_db.users.update_one(
        {"email": ADMIN_EMAIL},
        {"$setOnInsert": {"user_id": user_id, "email": ADMIN_EMAIL, "name": "Test Admin",
                          "picture": "", "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    u = mongo_db.users.find_one({"email": ADMIN_EMAIL})
    mongo_db.user_sessions.insert_one({
        "user_id": u["user_id"], "session_token": token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    yield token
    mongo_db.user_sessions.delete_one({"session_token": token})


@pytest.fixture(scope="module", autouse=True)
def _restore_hours_after_module(client, admin_token):
    yield
    # ALWAYS reset to defaults after this module
    h = {"Authorization": f"Bearer {admin_token}"}
    client.patch(f"{API}/admin/settings/hours", json={"days": DEFAULT_HOURS}, headers=h)


# ---------------- Public hours ----------------
def test_public_hours(client):
    r = client.get(f"{API}/settings/hours")
    assert r.status_code == 200
    data = r.json()
    assert "days" in data and "day_names" in data
    assert len(data["day_names"]) == 7
    for k in ["0", "1", "2", "3", "4", "5", "6"]:
        assert k in data["days"]
        for f in ("closed", "open", "close", "slot"):
            assert f in data["days"][k]


# ---------------- Admin hours GET auth ----------------
def test_admin_hours_requires_auth(client):
    r = client.get(f"{API}/admin/settings/hours")
    assert r.status_code == 401


def test_admin_hours_get_with_token(client, admin_token):
    r = client.get(f"{API}/admin/settings/hours",
                   headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    assert "days" in r.json()


# ---------------- Admin hours PATCH affects availability ----------------
def _pick_monday(offset_days=90):
    d = date(2026, 6, 15)  # known Monday
    return d.isoformat()


def _pick_tuesday():
    d = date(2026, 6, 16)  # known Tuesday
    return d.isoformat()


def test_patch_hours_changes_monday_slots(client, admin_token):
    h = {"Authorization": f"Bearer {admin_token}"}
    new = {k: dict(v) for k, v in DEFAULT_HOURS.items()}
    new["0"] = {"closed": False, "open": 9, "close": 15, "slot": 30}
    r = client.patch(f"{API}/admin/settings/hours", json={"days": new}, headers=h)
    assert r.status_code == 200, r.text
    saved = r.json()["days"]
    assert saved["0"]["open"] == 9 and saved["0"]["slot"] == 30

    mon = _pick_monday()
    av = client.get(f"{API}/availability", params={"date_str": mon}).json()
    times = [s["time"] for s in av["slots"]]
    assert av["closed"] is False
    assert times[0] == "09:00"
    assert "09:30" in times
    # Ends before 15:00 -> last slot 14:30
    assert times[-1] == "14:30"
    # Should have 12 slots (9:00..14:30 step 30)
    assert len(times) == 12


def test_patch_hours_close_tuesday(client, admin_token):
    h = {"Authorization": f"Bearer {admin_token}"}
    new = {k: dict(v) for k, v in DEFAULT_HOURS.items()}
    new["1"] = {"closed": True, "open": 8, "close": 17, "slot": 60}
    r = client.patch(f"{API}/admin/settings/hours", json={"days": new}, headers=h)
    assert r.status_code == 200
    tue = _pick_tuesday()
    av = client.get(f"{API}/availability", params={"date_str": tue}).json()
    assert av["closed"] is True
    assert av["slots"] == []


def test_reset_hours_to_defaults(client, admin_token):
    h = {"Authorization": f"Bearer {admin_token}"}
    r = client.patch(f"{API}/admin/settings/hours", json={"days": DEFAULT_HOURS}, headers=h)
    assert r.status_code == 200
    mon = _pick_monday()
    av = client.get(f"{API}/availability", params={"date_str": mon}).json()
    times = [s["time"] for s in av["slots"]]
    assert times[0] == "08:00"
    assert len(times) == 9  # 8..16 step 60


# ---------------- Manage booking flow ----------------
def _payload(date_str, slot="10:00", service="diagnostics"):
    return {
        "service_id": service, "vehicle_make": "TESTMake", "vehicle_model": "TESTM",
        "vehicle_year": "2022", "issue": "TEST manage",
        "booking_date": date_str, "time_slot": slot,
        "customer_name": "TEST Manage", "customer_email": "manage@test.com",
        "customer_phone": "555-0199",
    }


def _future_monday(weeks=6):
    d = date.today() + timedelta(days=weeks * 7)
    while d.weekday() != 0:
        d += timedelta(days=1)
    return d.isoformat()


@pytest.fixture
def created_booking(client, mongo_db):
    d = _future_monday(4)
    slot = "10:00"
    # try to create; if taken, bump forward
    for i in range(6):
        r = client.post(f"{API}/bookings", json=_payload(d, slot))
        if r.status_code == 200:
            break
        # move to next monday
        d = (datetime.strptime(d, "%Y-%m-%d").date() + timedelta(days=7)).isoformat()
    assert r.status_code == 200, r.text
    bk = r.json()
    yield bk
    mongo_db.bookings.delete_one({"id": bk["id"]})


def test_create_booking_returns_manage_token(client, mongo_db):
    d = _future_monday(5)
    for _ in range(6):
        r = client.post(f"{API}/bookings", json=_payload(d, "11:00"))
        if r.status_code == 200:
            break
        d = (datetime.strptime(d, "%Y-%m-%d").date() + timedelta(days=7)).isoformat()
    assert r.status_code == 200
    b = r.json()
    assert b.get("manage_token", "").startswith("mng_")
    mongo_db.bookings.delete_one({"id": b["id"]})


def test_manage_get_by_token(client, created_booking):
    tok = created_booking["manage_token"]
    r = client.get(f"{API}/bookings/manage/{tok}")
    assert r.status_code == 200
    assert r.json()["id"] == created_booking["id"]


def test_manage_get_invalid_token(client):
    r = client.get(f"{API}/bookings/manage/mng_doesnotexist_xxx")
    assert r.status_code == 404


def test_manage_reschedule_success_and_frees_old_slot(client, created_booking, mongo_db):
    tok = created_booking["manage_token"]
    old_date = created_booking["booking_date"]
    old_slot = created_booking["time_slot"]
    # new future Monday, different slot
    new_date = _future_monday(10)
    r = client.post(f"{API}/bookings/manage/{tok}/reschedule",
                    json={"booking_date": new_date, "time_slot": "13:00"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["booking_date"] == new_date and body["time_slot"] == "13:00"
    # old slot free
    av = client.get(f"{API}/availability", params={"date_str": old_date}).json()
    entry = next(s for s in av["slots"] if s["time"] == old_slot)
    assert entry["available"] is True


def test_manage_reschedule_invalid_slot(client, created_booking):
    tok = created_booking["manage_token"]
    d = _future_monday(11)
    r = client.post(f"{API}/bookings/manage/{tok}/reschedule",
                    json={"booking_date": d, "time_slot": "07:15"})
    assert r.status_code == 400


def test_manage_reschedule_closed_day(client, created_booking):
    tok = created_booking["manage_token"]
    # find Sunday
    d = date.today() + timedelta(days=10)
    while d.weekday() != 6:
        d += timedelta(days=1)
    r = client.post(f"{API}/bookings/manage/{tok}/reschedule",
                    json={"booking_date": d.isoformat(), "time_slot": "10:00"})
    assert r.status_code == 400


def test_manage_reschedule_conflict_409(client, created_booking, mongo_db):
    """Create a second booking on target slot, then attempt to reschedule to it."""
    tok = created_booking["manage_token"]
    target_date = _future_monday(12)
    target_slot = "14:00"
    # create a conflicting booking
    r0 = client.post(f"{API}/bookings", json=_payload(target_date, target_slot))
    if r0.status_code != 200:
        # shift day
        target_date = (datetime.strptime(target_date, "%Y-%m-%d").date()
                       + timedelta(days=7)).isoformat()
        r0 = client.post(f"{API}/bookings", json=_payload(target_date, target_slot))
    assert r0.status_code == 200, r0.text
    conflict_id = r0.json()["id"]
    r = client.post(f"{API}/bookings/manage/{tok}/reschedule",
                    json={"booking_date": target_date, "time_slot": target_slot})
    assert r.status_code == 409, r.text
    mongo_db.bookings.delete_one({"id": conflict_id})


def test_manage_cancel_frees_slot(client, mongo_db):
    d = _future_monday(14)
    for _ in range(6):
        r = client.post(f"{API}/bookings", json=_payload(d, "15:00"))
        if r.status_code == 200:
            break
        d = (datetime.strptime(d, "%Y-%m-%d").date() + timedelta(days=7)).isoformat()
    assert r.status_code == 200
    b = r.json()
    tok = b["manage_token"]
    rc = client.post(f"{API}/bookings/manage/{tok}/cancel")
    assert rc.status_code == 200
    assert rc.json()["status"] == "cancelled"
    # slot free
    av = client.get(f"{API}/availability", params={"date_str": d}).json()
    entry = next(s for s in av["slots"] if s["time"] == "15:00")
    assert entry["available"] is True
    # calling cancel again -> 400
    rc2 = client.post(f"{API}/bookings/manage/{tok}/cancel")
    assert rc2.status_code == 400
    # reschedule cancelled -> 400
    rr = client.post(f"{API}/bookings/manage/{tok}/reschedule",
                     json={"booking_date": _future_monday(16), "time_slot": "10:00"})
    assert rr.status_code == 400
    mongo_db.bookings.delete_one({"id": b["id"]})


def test_manage_cancel_completed_returns_400(client, mongo_db):
    d = _future_monday(18)
    for _ in range(6):
        r = client.post(f"{API}/bookings", json=_payload(d, "16:00"))
        if r.status_code == 200:
            break
        d = (datetime.strptime(d, "%Y-%m-%d").date() + timedelta(days=7)).isoformat()
    assert r.status_code == 200
    b = r.json()
    mongo_db.bookings.update_one({"id": b["id"]}, {"$set": {"status": "completed"}})
    rc = client.post(f"{API}/bookings/manage/{b['manage_token']}/cancel")
    assert rc.status_code == 400
    mongo_db.bookings.delete_one({"id": b["id"]})
