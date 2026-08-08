import os
import stripe
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / "backend" / ".env")
stripe.api_key = os.environ["STRIPE_SECRET_KEY"]

DEPOSIT_CENTS = int(float(os.environ.get("DEPOSIT_AMOUNT", "100"))) * 100

CATALOG = [
    {
        "emergent_product_id": "booking_deposit",
        "name": "Rosas Auto Works — Booking Deposit",
        "tax_code": "txcd_20030000",  # Auto repair / general services
        "prices": [
            {"lookup_key": "booking_deposit", "amount": DEPOSIT_CENTS, "currency": "usd"},
        ],
    },
]


def get_or_create_product(entry):
    for p in stripe.Product.list(active=True).auto_paging_iter():
        if p.to_dict().get("metadata", {}).get("emergent_product_id") == entry["emergent_product_id"]:
            return p
    return stripe.Product.create(
        name=entry["name"],
        tax_code=entry.get("tax_code"),
        metadata={"managed_by": "emergent", "emergent_product_id": entry["emergent_product_id"]},
    )


for entry in CATALOG:
    product = get_or_create_product(entry)
    for p in entry["prices"]:
        existing = stripe.Price.list(lookup_keys=[p["lookup_key"]], active=True, limit=1).data
        if existing and (existing[0].unit_amount != p["amount"] or existing[0].currency != p["currency"]):
            stripe.Price.modify(existing[0].id, active=False)
            existing = []
        if not existing:
            stripe.Price.create(
                product=product.id,
                unit_amount=p["amount"],
                currency=p["currency"],
                lookup_key=p["lookup_key"],
                transfer_lookup_key=True,
            )
            print(f"Created price {p['lookup_key']} = {p['amount']}")
        else:
            print(f"Price {p['lookup_key']} already exists")

print("Stripe catalog setup complete.")
