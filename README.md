# Rosas Auto Works — Full-Stack Booking App

Auto repair shop website (Lithia Springs, GA) with online booking, $100 Stripe deposit,
email confirmations, admin dashboard (Google auth), editable business hours, and
customer self-service (manage/reschedule/cancel).

**Stack:** React (CRA + craco) · FastAPI · MongoDB
**Brand:** black / copper-gold / silver · hummingbird-and-rose emblem

---

## Project structure
```
/app
├── backend/            FastAPI app
│   ├── server.py       all API routes (/api/*)
│   ├── requirements.txt
│   └── .env.example    copy to .env and fill in
├── frontend/           React app
│   ├── src/
│   │   ├── pages/      Home, Booking, PaymentSuccess/Cancel, ManageBooking, Admin*
│   │   ├── components/ Navbar, Footer, MobileBottomNav
│   │   ├── context/    AuthContext
│   │   └── lib/api.js
│   ├── public/logo.jpg emblem logo
│   ├── package.json
│   └── .env.example    copy to .env and fill in
└── scripts/
    ├── provision_stripe.py  provisions the claimable Stripe sandbox
    └── setup_stripe.py      creates the $100 deposit product + tax settings
```

## Prerequisites
- Node 18+ and **yarn**
- Python 3.11+
- MongoDB running locally (or a connection string)

## Backend setup
```bash
cd backend
cp .env.example .env          # fill in values
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

`backend/.env` keys:
- `MONGO_URL`, `DB_NAME` — MongoDB connection
- `CORS_ORIGINS` — allowed origins (use `*` for local)
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_ACCOUNT_ID`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_MODE`
- `EMERGENT_EMAIL_KEY`, `EMAIL_FROM_NAME` — Resend (Emergent-managed) email
- `OWNER_EMAIL` — where new-booking alerts go
- `ADMIN_EMAILS` — comma-separated allowlist of admin Google accounts
- `DEPOSIT_AMOUNT` — deposit in dollars (default 100)

## Stripe setup (one time)
```bash
python scripts/setup_stripe.py   # creates the "booking_deposit" product + tax head office
```

## Frontend setup
```bash
cd frontend
cp .env.example .env          # set REACT_APP_BACKEND_URL
yarn install
yarn start                    # dev server on :3000
```

## Key routes
- `/` marketing site  ·  `/book` booking wizard
- `/payment/success`, `/payment/cancel`
- `/manage/:token` customer self-service
- `/admin/login`, `/admin` (Google auth, admin allowlist)

## Notes
- Admin login uses Emergent-managed Google auth; only emails in `ADMIN_EMAILS` get in.
- Business hours are stored in MongoDB (`settings` collection) and editable from the admin dashboard.
- Test Stripe card: `4242 4242 4242 4242`, any future expiry, any CVC.
