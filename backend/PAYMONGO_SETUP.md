# AV Cooling — PayMongo Hosted Checkout setup

This is **hosted online payment**, not a direct GCash/bank API and not manual reference-number verification. Customers use PayMongo's own secure page. The AV Cooling backend does not receive PINs, OTPs, passwords, card details or banking logins.

## Customer / staff experience (simple)

**E-commerce product:** customer places an order and selects Cash, GCash (PayMongo), or QR Ph (bank app via PayMongo). Management confirms the appointment and final amount. For online payment, customer opens **My Account → My Payments → Pay securely**. PayMongo collects payment. A verified webhook sets the saved payment to PAID.

**Service request:** the same flow, but online payment starts after the service and price have been confirmed. The service payment is separate from a product order payment.

**POS product or walk-in service:** staff selects the method. Cash is collected and recorded normally. GCash/QR Ph creates a PENDING record; staff generates a secure PayMongo checkout link and shares it privately with the correct customer. A successful webhook updates PAID automatically. Unpaid POS stock is reserved, not marked as a completed sale.

**Facebook Agreement:** staff records the customer's preference, converts the agreement into an actual order or service, then generates the payment link from **Management → Payments**. A Facebook message alone does not create a payable PayMongo transaction.

**Cash:** no PayMongo link. Owner/Manager confirms actual cash collection in Management → Payments. Cashiers can record cash received at POS, according to POS authorization.

## Business setup — authorized owner / administrator

1. The business's authorized adult representative registers and completes the merchant onboarding/verification required by PayMongo. In the PayMongo merchant dashboard, enable the payment channels being offered (GCash and QR Ph for participating banking apps). **QR Ph is not a direct bank-account transfer API.**
2. Back up the production database. Apply all **previous AV Cooling migrations** that your deployed database needs. Then run `backend/migrations/20261112_paymongo_checkout.sql` **once**. That adds the idempotent checkout-session/event tables; no customer banking credentials are stored.
3. Enable the matching `CASH`, `GCASH`, and/or `BANK_TRANSFER` rows in the existing MySQL `payment_methods` table. `BANK_TRANSFER` is the application's legacy field name, but **displays QR Ph** in the new interface. Never label unsupported direct bank transfers as automatic.
4. Configure the backend secrets (never frontend Vite variables, never Git, never share actual keys in chat):

   ```dotenv
   PAYMONGO_SECRET_KEY=sk_test_REPLACE_WITH_MERCHANT_TEST_KEY
   PAYMONGO_WEBHOOK_SECRET=REPLACE_WITH_MERCHANT_TEST_WEBHOOK_SECRET
   FRONTEND_ORIGIN=http://localhost:5173
   ```

5. In PayMongo's webhook setup, subscribe to `checkout_session.payment.paid` and point the webhook to `https://YOUR_PUBLIC_BACKEND_DOMAIN/api/webhooks/paymongo`. This endpoint **must be publicly reachable over HTTPS**. `localhost` is not reachable from PayMongo. Use test-mode settings for test transactions; in production replace with the approved merchant's live keys and HTTPS frontend origin.
6. Restart backend. In test mode, test a successful GCash/QR Ph payment, a cancelled checkout, duplicate webhook delivery, duplicate link requests, a disabled method, incorrect amount/method, and a revoked staff session. Inspect the merchant dashboard and MySQL payment records.
7. Go live only after PayMongo account approval, real webhook delivery verification, application testing, privacy/security review, and working operational procedures for refunds/disputes/expired unpaid orders.

## Security rules

- **Never mark an order PAID from a browser redirect, screenshot, chat message, or customer-typed reference.** Only an authenticated signed PayMongo webhook can mark online payments PAID.
- Checkout uses the server-saved price, **PHP centavos**, merchant-approved payment method, and the existing payment ID. The frontend cannot set the charged amount.
- The backend checks the webhook signature over the original raw body, environment, checkout session ID, exact amount/currency, payment method, order/service status, and stored reference; duplicate events do not double-charge or double-fulfill.
- Authenticated staff access is restricted. POS cashiers can only create PayMongo links for POS and walk-in service records, not arbitrary customer orders.
- API keys and webhook secrets belong only in server-side secret storage. Use secure cookies, HTTPS, least-privilege DB accounts, backups, log monitoring, and secret rotation in production.
- **PayMongo charges transaction fees.** This implementation sets `pass_on_fees: false` (the merchant absorbs the processing fee). Verify the current rate and merchant fee settings.

## Important production limitations (do not ignore)

- **This code was not tested with a live PayMongo merchant account, a running MySQL deployment, or a browser payment.** Static checks do not prove end-to-end settlement.
- Only `checkout_session.payment.paid` is automated. PayMongo disputes, refund notifications, failed or cancelled checkout sessions, reconciliation for failed/delayed webhooks, and expiry of unpaid stock reservations need a complete operational/automated workflow before production. Do not simply delete or release an order with an active payment link; first expire/reconcile it with the provider.
- The backend deliberately blocks management cancellation while there is a recorded CREATING/ACTIVE PayMongo session. The merchant administrator must handle expiry/reconciliation; a self-service expire action is not included.
- Do not show the GCash/QR Ph options until the merchant credentials and webhook secret are configured **and** the matching MySQL payment method is enabled. Merchant channel activation must also be checked in the PayMongo dashboard.
- If a customer pays while an order/service has changed status, the webhook may be rejected for reconciliation instead of silently marking an incorrect record PAID. Staff must investigate provider and database records and arrange a legitimate refund if necessary.
- Rotate any previous access/refresh secrets or API keys that were accidentally shared in files or chat before production deployment.
