"""Backend tests for Rosas Auto Works API.
Covers: services, availability (weekday/Saturday/Sunday), bookings CRUD+conflict,
Stripe checkout & status, and admin-gated endpoints via seeded Mongo session.
"""
import os
import uuid
import pytest
import requests
from datetime import date, timedelta
from pathlib import Path
from dotenv import load_dotenv
from pymongo import MongoClient
from datetime import datetime, timezone

# Load backend env for Mongo access
load_dotenv(Path("/app/backend/.env"))

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE_URL:
    # fallback read frontend/.env
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL"):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE_URL}/api"
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
ADMIN_EMAIL = "z6md2dmmvg@privaterelay.appleid.com"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def mongo_db():
    c = MongoClient(MONGO_URL)
    return c[DB_NAME]


@pytest.fixture(scope="session")
def admin_token(mongo_db):
    token = f"test_session_{uuid.uuid4().hex}"
    user_id = f"user_test_{uuid.uuid4().hex[:8]}"
    mongo_db.users.update_one(
        {"email": ADMIN_EMAIL},
        {"$setOnInsert": {"user_id": user_id, "email": ADMIN_EMAIL, "name": "Test Admin",
                          "picture": "", "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    existing = mongo_db.users.find_one({"email": ADMIN_EMAIL})
    mongo_db.user_sessions.insert_one({
        "user_id": existing["user_id"],
        "session_token": token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    yield token
    mongo_db.user_sessions.delete_one({"session_token": token})


@pytest.fixture(scope="session")
def non_admin_token(mongo_db):
    token = f"test_session_{uuid.uuid4().hex}"
    user_id = f"user_test_{uuid.uuid4().hex[:8]}"
    email = f"nonadmin_{uuid.uuid4().hex[:6]}@example.com"
    mongo_db.users.insert_one({
        "user_id": user_id, "email": email, "name": "Non Admin", "picture": "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    mongo_db.user_sessions.insert_one({
        "user_id": user_id, "session_token": token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    yield token
    mongo_db.user_sessions.delete_one({"session_token": token})
    mongo_db.users.delete_one({"user_id": user_id})


def next_weekday(target_wd: int) -> str:
    """Return YYYY-MM-DD of the next date with given weekday (0=Mon...6=Sun) >= 3 days out."""
    d = date.today() + timedelta(days=3)
    while d.weekday() != target_wd:
        d += timedelta(days=1)
    return d.isoformat()


# ---------- Services ----------
def test_services_returns_8(client):
    r = client.get(f"{API}/services")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) == 8
    ids = {s["id"] for s in data}
    assert "diagnostics" in ids and "brakes" in ids


# ---------- Availability ----------
def test_availability_monday_60min(client):
    d = next_weekday(0)  # Monday
    r = client.get(f"{API}/availability", params={"date_str": d})
    assert r.status_code == 200
    data = r.json()
    assert data["closed"] is False
    times = [s["time"] for s in data["slots"]]
    assert times[0] == "08:00"
    assert "09:00" in times
    # 60-minute step: 08 through 16 => 9 slots
    assert len(times) == 9
    assert "08:30" not in times


def test_availability_saturday_30min(client):
    d = next_weekday(5)  # Saturday
    r = client.get(f"{API}/availability", params={"date_str": d})
    assert r.status_code == 200
    data = r.json()
    assert data["closed"] is False
    times = [s["time"] for s in data["slots"]]
    assert times[0] == "08:00"
    assert "08:30" in times
    # 30-min from 08:00 to 18:00 = 20 slots
    assert len(times) == 20


def test_availability_sunday_closed(client):
    d = next_weekday(6)  # Sunday
    r = client.get(f"{API}/availability", params={"date_str": d})
    assert r.status_code == 200
    data = r.json()
    assert data["closed"] is True
    assert data["slots"] == []


def test_availability_invalid_date(client):
    r = client.get(f"{API}/availability", params={"date_str": "not-a-date"})
    assert r.status_code == 400


# ---------- Bookings ----------
@pytest.fixture(scope="module")
def unique_slot_date():
    # Pick a Monday further out to avoid collisions
    d = date.today() + timedelta(days=14)
    while d.weekday() != 0:
        d += timedelta(days=1)
    return d.isoformat()


def _booking_payload(service_id="diagnostics", date_str=None, slot="15:00"):
    return {
        "service_id": service_id,
        "vehicle_make": "TESTMake", "vehicle_model": "TESTModel", "vehicle_year": "2020",
        "issue": "TEST issue",
        "booking_date": date_str, "time_slot": slot,
        "customer_name": "TEST User",
        "customer_email": "test@example.com",
        "customer_phone": "555-0100",
    }


def test_booking_create_success_and_get(client, unique_slot_date, mongo_db):
    payload = _booking_payload(date_str=unique_slot_date, slot="15:00")
    r = client.post(f"{API}/bookings", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["id"].startswith("bk_")
    assert data["status"] == "pending"
    assert data["deposit_paid"] is False
    assert data["service_name"] == "Diagnostics & Check Engine"
    # GET verify persistence
    g = client.get(f"{API}/bookings/{data['id']}")
    assert g.status_code == 200
    assert g.json()["id"] == data["id"]
    # cleanup
    mongo_db.bookings.delete_one({"id": data["id"]})


def test_booking_invalid_service(client, unique_slot_date):
    payload = _booking_payload(service_id="not-a-service", date_str=unique_slot_date, slot="14:00")
    r = client.post(f"{API}/bookings", json=payload)
    assert r.status_code == 400


def test_booking_sunday_rejected(client):
    sunday = next_weekday(6)
    payload = _booking_payload(date_str=sunday, slot="10:00")
    r = client.post(f"{API}/bookings", json=payload)
    assert r.status_code == 400


def test_booking_conflict_409(client, unique_slot_date, mongo_db):
    slot = "16:00"
    p = _booking_payload(date_str=unique_slot_date, slot=slot)
    r1 = client.post(f"{API}/bookings", json=p)
    assert r1.status_code == 200
    bk_id = r1.json()["id"]
    # second attempt same date/slot
    r2 = client.post(f"{API}/bookings", json=p)
    assert r2.status_code == 409
    # availability should show that slot unavailable
    av = client.get(f"{API}/availability", params={"date_str": unique_slot_date}).json()
    slot_entry = next(s for s in av["slots"] if s["time"] == slot)
    assert slot_entry["available"] is False
    mongo_db.bookings.delete_one({"id": bk_id})


# ---------- Payments ----------
@pytest.fixture(scope="module")
def paid_booking(client, mongo_db):
    d = date.today() + timedelta(days=21)
    while d.weekday() != 0:
        d += timedelta(days=1)
    p = _booking_payload(date_str=d.isoformat(), slot="11:00")
    r = client.post(f"{API}/bookings", json=p)
    assert r.status_code == 200
    booking = r.json()
    yield booking
    mongo_db.bookings.delete_one({"id": booking["id"]})
    mongo_db.payment_transactions.delete_many({"booking_id": booking["id"]})


def test_payments_checkout_creates_session(client, paid_booking, mongo_db):
    r = client.post(f"{API}/payments/checkout", json={
        "booking_id": paid_booking["id"],
        "origin_url": BASE_URL,
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert "checkout_url" in data and data["checkout_url"].startswith("https://")
    assert "stripe.com" in data["checkout_url"] or "checkout.stripe.com" in data["checkout_url"]
    assert data["session_id"].startswith("cs_")
    # payment_transactions record persisted
    rec = mongo_db.payment_transactions.find_one({"session_id": data["session_id"]})
    assert rec is not None
    assert rec["payment_status"] == "pending"
    # Save for status test
    paid_booking["_session_id"] = data["session_id"]


def test_payment_status_pending(client, paid_booking):
    sid = paid_booking.get("_session_id")
    assert sid, "checkout must run first"
    r = client.get(f"{API}/payments/status/{sid}")
    assert r.status_code == 200
    data = r.json()
    assert data["session_id"] == sid
    assert data["payment_status"] in ("pending", "unpaid")


# ---------- Admin auth gating ----------
def test_admin_bookings_requires_auth(client):
    r = client.get(f"{API}/admin/bookings")
    assert r.status_code == 401


def test_admin_stats_requires_auth(client):
    r = client.get(f"{API}/admin/stats")
    assert r.status_code == 401


def test_admin_non_admin_forbidden(client, non_admin_token):
    r = client.get(f"{API}/admin/bookings",
                   headers={"Authorization": f"Bearer {non_admin_token}"})
    assert r.status_code == 403


def test_admin_bookings_list_with_admin(client, admin_token):
    r = client.get(f"{API}/admin/bookings",
                   headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_admin_stats_with_admin(client, admin_token):
    r = client.get(f"{API}/admin/stats",
                   headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    data = r.json()
    for k in ("total", "pending", "confirmed", "completed", "cancelled", "deposit_revenue"):
        assert k in data


def test_admin_status_and_reschedule(client, admin_token, mongo_db):
    # Create a booking
    d = date.today() + timedelta(days=28)
    while d.weekday() != 0:
        d += timedelta(days=1)
    p = _booking_payload(date_str=d.isoformat(), slot="13:00")
    r = client.post(f"{API}/bookings", json=p)
    assert r.status_code == 200
    bk = r.json()
    h = {"Authorization": f"Bearer {admin_token}"}
    # confirm
    r2 = client.patch(f"{API}/admin/bookings/{bk['id']}/status",
                     json={"status": "confirmed"}, headers=h)
    assert r2.status_code == 200
    assert r2.json()["status"] == "confirmed"
    # filter by confirmed
    lst = client.get(f"{API}/admin/bookings", params={"status": "confirmed"}, headers=h).json()
    assert any(b["id"] == bk["id"] for b in lst)
    # reschedule
    new_slot = "14:00"
    r3 = client.patch(f"{API}/admin/bookings/{bk['id']}/reschedule",
                     json={"booking_date": d.isoformat(), "time_slot": new_slot}, headers=h)
    assert r3.status_code == 200
    assert r3.json()["time_slot"] == new_slot
    # invalid status
    r4 = client.patch(f"{API}/admin/bookings/{bk['id']}/status",
                     json={"status": "bogus"}, headers=h)
    assert r4.status_code == 400
    # cancel
    r5 = client.patch(f"{API}/admin/bookings/{bk['id']}/status",
                     json={"status": "cancelled"}, headers=h)
    assert r5.status_code == 200
    # cleanup
    mongo_db.bookings.delete_one({"id": bk["id"]})
