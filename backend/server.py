from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Cookie, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import httpx
import stripe
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Annotated
from datetime import datetime, timezone, timedelta, date, time
from bson import ObjectId
from pydantic import BeforeValidator
from pymongo import ASCENDING
from pymongo.errors import DuplicateKeyError

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Rosas Auto Works")

OWNER_EMAIL = os.environ.get("OWNER_EMAIL", "")
ADMIN_EMAILS = {e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()}
DEPOSIT_AMOUNT = float(os.environ.get("DEPOSIT_AMOUNT", "100"))

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ---------------------------------------------------------------------------
# Mongo helpers
# ---------------------------------------------------------------------------
PyObjectId = Annotated[str, BeforeValidator(str)]


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Static config: services + business hours
# ---------------------------------------------------------------------------
SERVICES = [
    {"id": "diagnostics", "name": "Diagnostics & Check Engine", "duration": 60, "desc": "Computer diagnostics to pinpoint the real problem before any work begins."},
    {"id": "oil-service", "name": "Oil & Fluid Service", "duration": 30, "desc": "Full-synthetic oil changes and fluid top-offs for all makes."},
    {"id": "brakes", "name": "Brakes & Rotors", "duration": 60, "desc": "Pads, rotors, calipers and brake fluid service."},
    {"id": "engine-repair", "name": "Engine Repair", "duration": 60, "desc": "From misfires to major repairs across European, Asian & Domestic."},
    {"id": "transmission", "name": "Transmission Service", "duration": 60, "desc": "Fluid service, diagnostics and repair."},
    {"id": "diesel", "name": "Diesel Service", "duration": 60, "desc": "Specialized diesel maintenance and performance work."},
    {"id": "performance", "name": "Performance Tuning", "duration": 60, "desc": "Upgrades and tuning to unlock real results."},
    {"id": "fleet", "name": "Fleet Maintenance", "duration": 30, "desc": "Keep your business vehicles on the road."},
]

# weekday: 0=Mon ... 6=Sun.  (open_hour, close_hour, slot_minutes) or None if closed
BUSINESS_HOURS = {
    0: (8, 17, 60),
    1: (8, 17, 60),
    2: (8, 17, 60),
    3: (8, 17, 60),
    4: (8, 17, 60),
    5: (8, 18, 30),   # Saturday
    6: None,          # Sunday closed
}


def generate_day_slots(d: date) -> List[str]:
    cfg = BUSINESS_HOURS.get(d.weekday())
    if not cfg:
        return []
    open_h, close_h, step = cfg
    slots = []
    cur = datetime.combine(d, time(open_h, 0))
    end = datetime.combine(d, time(close_h, 0))
    while cur < end:
        slots.append(cur.strftime("%H:%M"))
        cur += timedelta(minutes=step)
    return slots


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class BookingCreate(BaseModel):
    service_id: str
    vehicle_make: str
    vehicle_model: str
    vehicle_year: str
    issue: str
    booking_date: str   # YYYY-MM-DD
    time_slot: str      # HH:MM
    customer_name: str
    customer_email: EmailStr
    customer_phone: str


class Booking(BaseModel):
    id: str
    service_id: str
    service_name: str
    vehicle_make: str
    vehicle_model: str
    vehicle_year: str
    issue: str
    booking_date: str
    time_slot: str
    customer_name: str
    customer_email: str
    customer_phone: str
    status: str = "pending"          # pending | confirmed | completed | cancelled
    deposit_paid: bool = False
    deposit_amount: float = DEPOSIT_AMOUNT
    session_id: Optional[str] = None
    created_at: str


class StatusUpdate(BaseModel):
    status: str


class RescheduleRequest(BaseModel):
    booking_date: str
    time_slot: str


class CheckoutRequest(BaseModel):
    booking_id: str
    origin_url: str


def booking_from_doc(doc) -> dict:
    doc = dict(doc)
    doc.pop("_id", None)
    return doc


# ---------------------------------------------------------------------------
# Auth (Emergent Google Auth)
# ---------------------------------------------------------------------------
async def get_current_user(
    session_token: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
):
    token = session_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now_utc():
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_admin(user=Depends(get_current_user)):
    if user.get("email", "").lower() not in ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@api_router.post("/auth/session")
async def process_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing session_id")
    async with httpx.AsyncClient(timeout=30) as hc:
        resp = await hc.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session_id")
    data = resp.json()
    email = data["email"]
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": data.get("name", ""),
            "picture": data.get("picture", ""),
            "created_at": now_utc().isoformat(),
        })
    session_token = data["session_token"]
    expires_at = now_utc() + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": now_utc().isoformat(),
    })
    response.set_cookie(
        key="session_token", value=session_token, httponly=True,
        secure=True, samesite="none", path="/", max_age=7 * 24 * 60 * 60,
    )
    is_admin = email.lower() in ADMIN_EMAILS
    return {"user_id": user_id, "email": email, "name": data.get("name", ""),
            "picture": data.get("picture", ""), "is_admin": is_admin}


@api_router.get("/auth/me")
async def auth_me(user=Depends(get_current_user)):
    return {"user_id": user["user_id"], "email": user["email"], "name": user.get("name", ""),
            "picture": user.get("picture", ""), "is_admin": user["email"].lower() in ADMIN_EMAILS}


@api_router.post("/auth/logout")
async def logout(response: Response, session_token: Optional[str] = Cookie(default=None)):
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie("session_token", path="/")
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Public: services + availability
# ---------------------------------------------------------------------------
@api_router.get("/services")
async def get_services():
    return SERVICES


@api_router.get("/availability")
async def availability(date_str: str):
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date")
    all_slots = generate_day_slots(d)
    # bookings that hold a slot: any not cancelled
    taken_docs = await db.bookings.find(
        {"booking_date": date_str, "status": {"$ne": "cancelled"}}, {"_id": 0, "time_slot": 1}
    ).to_list(500)
    taken = {b["time_slot"] for b in taken_docs}
    slots = [{"time": s, "available": s not in taken} for s in all_slots]
    return {"date": date_str, "closed": len(all_slots) == 0, "slots": slots}


# ---------------------------------------------------------------------------
# Email helper
# ---------------------------------------------------------------------------
async def send_email(to_email: str, subject: str, html: str):
    if not EMAIL_KEY:
        logger.warning("Email key missing, skipping email")
        return
    payload = {"to": [to_email], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    try:
        async with httpx.AsyncClient(timeout=30) as hc:
            resp = await hc.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY}, json=payload,
            )
        resp.raise_for_status()
    except Exception as e:
        logger.error(f"Email send error: {e}")


def _email_wrap(title: str, body_rows: str) -> str:
    return f"""
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;font-family:Arial,sans-serif;">
      <tr><td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e4e4e7;">
          <tr><td style="background:#0A0A0A;padding:20px 28px;">
            <span style="color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:1px;">ROSAS <span style="color:#E63946;">AUTO WORKS</span></span>
          </td></tr>
          <tr><td style="padding:28px;">
            <h2 style="margin:0 0 16px;color:#0A0A0A;font-size:20px;">{title}</h2>
            <table width="100%" cellpadding="6" cellspacing="0" style="font-size:14px;color:#333;">{body_rows}</table>
          </td></tr>
          <tr><td style="padding:18px 28px;background:#f4f4f5;color:#71717A;font-size:12px;">
            Rosas Auto Works · Lithia Springs, GA · ONE SHOP. ALL MAKES. REAL RESULTS.
          </td></tr>
        </table>
      </td></tr>
    </table>
    """


def _booking_rows(b: dict) -> str:
    return f"""
      <tr><td style="color:#71717A;">Service</td><td><strong>{b['service_name']}</strong></td></tr>
      <tr><td style="color:#71717A;">Vehicle</td><td>{b['vehicle_year']} {b['vehicle_make']} {b['vehicle_model']}</td></tr>
      <tr><td style="color:#71717A;">Date</td><td>{b['booking_date']}</td></tr>
      <tr><td style="color:#71717A;">Time</td><td>{b['time_slot']}</td></tr>
      <tr><td style="color:#71717A;">Name</td><td>{b['customer_name']}</td></tr>
      <tr><td style="color:#71717A;">Phone</td><td>{b['customer_phone']}</td></tr>
    """


async def notify_booking_paid(b: dict):
    rows = _booking_rows(b) + f'<tr><td style="color:#71717A;">Deposit</td><td>${b["deposit_amount"]:.0f} paid ✓</td></tr>'
    cust_html = _email_wrap(
        "Your appointment request is received!",
        rows + '<tr><td colspan="2" style="padding-top:12px;color:#333;">Thanks for choosing Rosas Auto Works. Your deposit is confirmed and our team will review and confirm your slot shortly.</td></tr>',
    )
    await send_email(b["customer_email"], "Rosas Auto Works — Appointment Request Received", cust_html)
    if OWNER_EMAIL:
        admin_html = _email_wrap("New booking (deposit paid)", rows)
        await send_email(OWNER_EMAIL, "New Booking — Deposit Paid", admin_html)


async def notify_status_change(b: dict):
    status = b["status"]
    titles = {
        "confirmed": "Your appointment is confirmed!",
        "cancelled": "Your appointment was cancelled",
        "completed": "Thanks — service completed!",
    }
    title = titles.get(status, f"Appointment status: {status}")
    html = _email_wrap(title, _booking_rows(b))
    await send_email(b["customer_email"], f"Rosas Auto Works — {title}", html)


# ---------------------------------------------------------------------------
# Bookings
# ---------------------------------------------------------------------------
@api_router.post("/bookings")
async def create_booking(payload: BookingCreate):
    service = next((s for s in SERVICES if s["id"] == payload.service_id), None)
    if not service:
        raise HTTPException(status_code=400, detail="Invalid service")
    # validate slot availability
    avail = await availability(payload.booking_date)
    if avail["closed"]:
        raise HTTPException(status_code=400, detail="Shop is closed on that date")
    slot = next((s for s in avail["slots"] if s["time"] == payload.time_slot), None)
    if not slot or not slot["available"]:
        raise HTTPException(status_code=409, detail="Selected time slot is no longer available")
    booking_id = f"bk_{uuid.uuid4().hex[:12]}"
    doc = {
        "id": booking_id,
        "service_id": service["id"],
        "service_name": service["name"],
        "vehicle_make": payload.vehicle_make,
        "vehicle_model": payload.vehicle_model,
        "vehicle_year": payload.vehicle_year,
        "issue": payload.issue,
        "booking_date": payload.booking_date,
        "time_slot": payload.time_slot,
        "customer_name": payload.customer_name,
        "customer_email": payload.customer_email,
        "customer_phone": payload.customer_phone,
        "status": "pending",
        "deposit_paid": False,
        "deposit_amount": DEPOSIT_AMOUNT,
        "session_id": None,
        "slot_key": f"{payload.booking_date}_{payload.time_slot}",
        "created_at": now_utc().isoformat(),
    }
    try:
        await db.bookings.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="Selected time slot is no longer available")
    return booking_from_doc(doc)


@api_router.get("/bookings/{booking_id}")
async def get_booking(booking_id: str):
    doc = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Booking not found")
    return doc


@api_router.get("/admin/bookings")
async def list_bookings(status: Optional[str] = None, admin=Depends(require_admin)):
    q = {}
    if status and status != "all":
        q["status"] = status
    docs = await db.bookings.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return docs


@api_router.get("/admin/stats")
async def admin_stats(admin=Depends(require_admin)):
    docs = await db.bookings.find({}, {"_id": 0}).to_list(2000)
    def count(s):
        return len([d for d in docs if d["status"] == s])
    revenue = sum(d["deposit_amount"] for d in docs if d.get("deposit_paid"))
    return {
        "total": len(docs), "pending": count("pending"), "confirmed": count("confirmed"),
        "completed": count("completed"), "cancelled": count("cancelled"),
        "deposit_revenue": revenue,
    }


@api_router.patch("/admin/bookings/{booking_id}/status")
async def update_status(booking_id: str, payload: StatusUpdate, admin=Depends(require_admin)):
    if payload.status not in {"pending", "confirmed", "completed", "cancelled"}:
        raise HTTPException(status_code=400, detail="Invalid status")
    doc = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Booking not found")
    await db.bookings.update_one({"id": booking_id}, {"$set": {"status": payload.status}})
    if payload.status == "cancelled":
        await db.bookings.update_one({"id": booking_id}, {"$unset": {"slot_key": ""}})
    doc["status"] = payload.status
    await notify_status_change(doc)
    return doc


@api_router.patch("/admin/bookings/{booking_id}/reschedule")
async def reschedule(booking_id: str, payload: RescheduleRequest, admin=Depends(require_admin)):
    doc = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Booking not found")
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"booking_date": payload.booking_date, "time_slot": payload.time_slot,
                  "slot_key": f"{payload.booking_date}_{payload.time_slot}"}},
    )
    doc["booking_date"] = payload.booking_date
    doc["time_slot"] = payload.time_slot
    await notify_status_change({**doc, "status": "confirmed"})
    return doc


# ---------------------------------------------------------------------------
# Payments (Stripe)
# ---------------------------------------------------------------------------
@api_router.post("/payments/checkout")
async def create_checkout(req: CheckoutRequest):
    booking = await db.bookings.find_one({"id": req.booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    prices = stripe.Price.list(lookup_keys=["booking_deposit"], active=True, limit=1).data
    if not prices:
        raise HTTPException(status_code=500, detail="Deposit price not configured")
    price = prices[0]
    session = stripe.checkout.Session.create(
        line_items=[{"price": price.id, "quantity": 1}],
        mode="payment",
        success_url=f"{req.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{req.origin_url}/payment/cancel",
        automatic_tax={"enabled": True},
        billing_address_collection="required",
        customer_email=booking["customer_email"],
        metadata={"booking_id": req.booking_id, "lookup_key": "booking_deposit"},
    )
    await db.payment_transactions.insert_one({
        "session_id": session.id,
        "booking_id": req.booking_id,
        "amount": (price.unit_amount or 0) / 100.0,
        "currency": price.currency,
        "status": "initiated",
        "payment_status": "pending",
        "created_at": now_utc().isoformat(),
        "updated_at": now_utc().isoformat(),
    })
    await db.bookings.update_one({"id": req.booking_id}, {"$set": {"session_id": session.id}})
    return {"checkout_url": session.url, "session_id": session.id}


async def _mark_paid(session_id: str):
    rec = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not rec:
        return
    result = await db.payment_transactions.update_one(
        {"session_id": session_id, "payment_status": {"$ne": "paid"}},
        {"$set": {"status": "completed", "payment_status": "paid", "updated_at": now_utc().isoformat()}},
    )
    if result.modified_count:
        booking = await db.bookings.find_one({"id": rec["booking_id"]}, {"_id": 0})
        if booking and not booking.get("deposit_paid"):
            await db.bookings.update_one({"id": rec["booking_id"]}, {"$set": {"deposit_paid": True}})
            booking["deposit_paid"] = True
            await notify_booking_paid(booking)


@api_router.get("/payments/status/{session_id}")
async def payment_status(session_id: str):
    rec = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if rec.get("payment_status") != "paid":
        try:
            s = stripe.checkout.Session.retrieve(session_id)
            if s.payment_status == "paid" or s.status == "complete":
                await _mark_paid(session_id)
                rec = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        except stripe.error.StripeError:
            pass
    return {"session_id": rec["session_id"], "status": rec["status"],
            "payment_status": rec["payment_status"], "booking_id": rec.get("booking_id")}


@api_router.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid signature")
    obj, t = event["data"]["object"], event["type"]
    if t == "checkout.session.completed":
        await _mark_paid(obj["id"])
    return {"status": "ok"}


@api_router.get("/")
async def root():
    return {"message": "Rosas Auto Works API"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def create_indexes():
    await db.bookings.create_index([("slot_key", ASCENDING)], unique=True, sparse=True)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
