# AV Cooling System — Functional Adaptive Frontend v3

Frontend-only React + Vite prototype for AV Cooling System.

## Run

```bash
npm install
npm run dev
```

## What is functional in this prototype

### Customer side
- Adaptive homepage/navigation for desktop, tablet/iPad, and mobile
- Product catalog with managed catalog updates reflected in Shop/Home/POS
- Product variants and Add to Cart
- Login/register preserves pending Add to Cart / Checkout / Service Booking actions
- Cart and Checkout
- Placing an order saves it to the customer account prototype
- Service booking form saves requests to customer history
- Contact form saves messages into Management > Contact Messages
- Customer profile, orders, services, payments, notifications, feedback, addresses, and password mock flows

### Management side
- Role-based navigation for OWNER, MANAGER, SALES_CASHIER, and TECHNICIAN
- Dashboard connected to local prototype data
- POS / Walk-in sales with products/services, payment, cash change, receipt, and order creation
- POS also creates payment records, stock movements, service requests when applicable, audit logs, and notifications
- Orders: search, details, and status progression
- Payments: review and Paid/Refunded workflow
- Products: search, add, view, edit; catalog changes are reflected on customer Shop/Home and POS in the same browser
- Inventory: per-HP stock values and manual +/- adjustments
- Stock Movements: add/view records
- Service Types: add/edit/activate/deactivate
- Service Requests: search, approve/schedule/complete, view, add
- Work Orders: add/view/start/complete
- Technicians: view and availability changes
- Schedules: add/view/confirm/complete
- Customers: search, profile view, activate/suspend
- Promo image replacement
- Website Content: view/edit/publish/unpublish
- Feedback: review and mark reviewed
- Contact Messages: view and mark replied
- Facebook Requests: view and mark replied
- Reports: operational cards and CSV export
- Notifications: mark one/all read
- Audit Logs: read-only operational history

## Prototype storage

This build has no backend yet. Actions are stored in browser `localStorage` so workflows can be tested without MongoDB/Express.

Refreshing the browser preserves most prototype changes. Clearing browser site data resets them.
