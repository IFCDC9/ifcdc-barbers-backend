# PAYMENT_SYSTEM_STABLE_V1

Recovery checkpoint — PayPal live on Render `ifcdc-barbers-backend696`, booking capture, email confirmations verified stable.

## Locked production targets

| Component | Value |
|-----------|--------|
| API host | `https://ifcdc-barbers-backend696.onrender.com` |
| PayPal | `PAYPAL_ENV=live` (must match live app credentials) |
| Mobile scheme | `ifcdc-barbers://` |
| Checkout route | `POST /api/app-bookings/start` → `POST /api/app-bookings/finalize` |

**Do not use** `ifcdc-barbers-backend.onrender.com` (stale / missing booking routes).

## Payment status labels (UI)

| `payment_status` | Headline |
|------------------|----------|
| `paid_full` | PAID IN FULL |
| `deposit_paid` + balance > 0 | DEPOSIT PAID · BALANCE DUE |
| `deposit_paid` | DEPOSIT PAID |
| `unpaid` / pending | PAYMENT NOT COMPLETED |
| `payment_failed` | PAYMENT FAILED |
| `payment_mismatch` | PAYMENT MISMATCH |

Source of truth: PayPal capture amount → `bookingPaymentSettlement.cjs` (not `payment_type` label).

## Verification commands

```bash
# Health + PayPal OAuth (after deploy with paypalEnv.cjs)
curl -s https://ifcdc-barbers-backend696.onrender.com/api/app-bookings/health | jq .

# Checkout start (replace slot/service as needed)
curl -s -X POST https://ifcdc-barbers-backend696.onrender.com/api/app-bookings/start \
  -H "Content-Type: application/json" \
  -d '{"barberName":"Fade Master","barberId":"30a41f71-dccb-43e8-88e0-53045560cda5","dateLabel":"Today","timeLabel":"12:00 PM","redirectUri":"ifcdc-barbers://paypal-booking/","serviceId":"1"}'
```

## Rollback

```bash
git checkout PAYMENT_SYSTEM_STABLE_V1
# Redeploy Render from this tag if production regresses
```

## Do not change without OAuth verification

- `PAYPAL_ENV`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` on Render
- Use `GET /api/app-bookings/health` → `paypal.oauth.ok` and `paypal.alignment.ok` before/after any PayPal env edit
