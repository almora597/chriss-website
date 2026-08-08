# Rosas Auto Works — PRD

## Original Problem Statement
Rebuild the Rosas Auto Works (Lithia Springs, GA) website as a full-stack app with online appointment booking, a $100 refundable deposit (Stripe), automated email confirmations, and an admin dashboard. Keep the "ONE SHOP. ALL MAKES. REAL RESULTS." brand energy with a diagnostic-first, trustworthy automotive feel. Mobile-first with a bottom nav.

## Architecture
- **Frontend:** React (CRA + craco, `@/` alias), Tailwind, shadcn/ui, Phosphor icons, framer-motion. Fonts: Cabinet Grotesk (headings) + IBM Plex Sans (body).
- **Backend:** FastAPI, all routes under `/api`. Motor (async MongoDB).
- **DB:** MongoDB — collections: `bookings`, `payment_transactions`, `users`, `user_sessions`.
- **Integrations:** Stripe (claimable sandbox, lookup_key `booking_deposit`, $100, automatic tax w/ head-office set to Lithia Springs GA), Emergent-managed Resend email, Emergent Google Auth for admin.

## User Personas
- **Customer** — local car owner booking service on mobile.
- **Admin/Owner** — manages bookings via Google-auth dashboard (allowlisted email).

## Core Requirements (static)
- Redesigned marketing site (hero, services, why-rosas, vehicles, contact, mobile bottom nav).
- 4-step booking wizard → $100 Stripe deposit → booking `pending`.
- Email confirmation to customer + owner notification on paid deposit; email on status change.
- Admin: list + calendar views, confirm/complete/cancel/reschedule, stats.
- Business hours: Mon–Fri 8–5 (60-min slots), Sat 8–6 (30-min slots), Sun closed. 1 car per slot (sparse unique index on slot_key).

## Implemented (2026-06)
- Public marketing site with all sections + mobile bottom nav.
- Availability engine + 4-step booking wizard.
- Stripe deposit checkout + status polling + webhook + paid-flow email notifications.
- Admin Google-auth login, protected dashboard, list/calendar views, status + reschedule actions, stats.
- Atomic slot guard (sparse unique index) → 409 on double-book.
- Verified via testing agent (backend 15/17→fixed; frontend flows pass) + curl.

## Config / Credentials
- Admin allowlist: `ADMIN_EMAILS` in backend/.env = z6md2dmmvg@privaterelay.appleid.com.
- Owner notification email: `OWNER_EMAIL` (same).
- Deposit: `DEPOSIT_AMOUNT=100`, refundable on cancellation (policy; refund not yet automated).

## Backlog / Remaining
- **P1:** SMS/WhatsApp reminders via Twilio (deferred — user chose email-only for now).
- **P1:** 24h-before appointment reminder emails (scheduler).
- **P2:** Automated Stripe refund on admin cancellation.
- **P2:** Admin-editable business hours / slot config (currently static).
- **P2:** Customer "manage my booking" self-service link.

## Next Tasks
1. Add Twilio SMS confirmations + 24h reminders.
2. Automate deposit refund when admin cancels.
3. Admin UI to edit business hours / slot capacity.
