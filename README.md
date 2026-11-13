AV Cooling System — Simple User Guide and Defense Notes
Purpose: A simple guide for first-time users and a reviewer for the project defense.
Important: This guide is based on the uploaded AV Cooling System project and the workflows recently discussed. Some recent code changes were provided separately and may not yet be installed in your local project. Test every feature on your actual running system before demonstrating it. The limitations section identifies features that are still incomplete or need improvement.
PART 1 — SIMPLE USER GUIDE (README)

1. What is AV Cooling System?
   AV Cooling System is a website for selling air-conditioning units, accepting service bookings, managing orders, scheduling technicians, recording payments, and monitoring inventory.
   It has three main areas:

- E-commerce website: For customers who want to buy aircons or request services.
- My Account: For customers who want to check and manage their own transactions.
- Management system: For the Owner, Manager, Cashier, and Technician to handle business operations.
  Simple rule: Customers submit requests. Management reviews and organizes the work. Technicians do the actual field work. Payments are recorded only when verified.

2. E-commerce website — for customers
   Home
   How to use: Open the website to see business information, featured products, services, and links to other pages.
   Shop / Products
   How to use: Open Shop, browse aircon units, check the model, horsepower (HP), price, and availability. Open a product to see more details.
   Product Details
   How to use: Select the available variant/HP and quantity. Choose Add to Cart or the direct purchase option when available.
   Cart
   How to use: Review selected items, change quantities, remove unwanted products, then proceed to checkout.
   Checkout
   How to use: Log in, provide the recipient name and phone number, select the delivery area, enter the complete delivery address, choose an available appointment, and review the total. Submit the order.
   Remember: The inspected online checkout uses cash as the payment method. Placing an order does not mean payment has been collected. The order still needs staff processing.
   Order Confirmation
   How to use: After submitting, check the order reference number and details. Use My Account → Orders to track progress.
   Services
   How to use: Choose a service such as installation, cleaning, repair, troubleshooting, relocation, or emergency service. Enter the required aircon details, contact/address, preferred appointment, and concern. Submit the booking.
   For Aircon Relocation: Provide the pickup address (where the unit is now) and destination address (where it will be moved/installed).
   About / Our Expertise / Why Choose Us
   How to use: Read about the business, its experience, and the services it provides.
   Contact
   How to use: Use the shown phone, location/Google Maps, or Messenger link to contact the business. The website links to Messenger; it is not a built-in live chat.
   Reviews
   How to use: Read customer feedback that has permission to appear publicly. Registered customers can submit their own feedback from My Account.
   Register / Login
   How to use: Create a customer account, then log in to place orders, book services, and use My Account.
   Forgot Password
   Current limitation: The inspected page only simulates sending a reset link. It does not send a real email or reset a password. Do not demonstrate it as a working email recovery feature.
3. My Account — for registered customers
   Profile
   How to use: View or update personal account information and contact details where allowed.
   My Orders
   How to use: Check order status, products, totals, and appointment details. Edit or cancel a pending order only when the system allows it. Once processing has started, some changes are restricted.
   My Services
   How to use: View service requests, appointment details, and progress. Edit, cancel, or remove an eligible cancelled request using the available actions.
   Payments
   How to use: Check whether an order payment is Pending, Paid, or another recorded status. A pending payment should not be treated as paid.
   Notifications
   How to use: Read updates about orders and services. Mark notifications as read or delete unwanted notifications. Deleting a notification does not delete the order or service.
   Feedback
   How to use: Give a rating and comment after an eligible purchase or service. Decide whether the review may appear publicly.
   Saved Addresses
   How to use: Add addresses, set a default address, or remove an address. This makes future bookings or checkout easier.
   Change Password
   How to use: Change the account password using the account's password settings.
   Aircon Capacity Calculator
   How to use: Enter room area and other heat factors such as people, windows, appliances, and room type. The system estimates the cooling requirement and suggests a possible HP size based on available products.
   Remember: It is an estimate only. Actual aircon sizing should be checked by a qualified technician.
4. Management system — who can use what?
   User role Main responsibility
   Owner Overall access, staff accounts, audit logs, and business management
   Manager Orders, services, schedule changes, technician assignments, inventory, payments, and reporting
   Cashier POS product sales, walk-in service booking/intake, and personal notifications
   Technician Assigned jobs, job progress, schedules, and allowed tools
   Important: Different roles should only see and use the tools they need. The final permissions must be tested with actual accounts, not only by hiding menu items.

Management Login
How to use: Sign in with an authorized staff account. The available menu depends on the staff role.
Dashboard
How to use: View summary numbers, recent activity, payments, order/service statuses, and items needing attention. Use it to see what needs action first.
POS — Product Sales
How to use: Choose a product and HP variant, set quantity, enter customer details, check the price and cash received, then complete the sale only after verifying payment. Print a receipt where the option is available.
Remember: Only authorized management roles should control discounts. A cashier's normal task is making sales, not editing inventory directly.
POS — Walk-in Service Booking
How to use: Enter customer name, contact number, service type, aircon information, service address, and available appointment. For relocation, enter both pickup and destination addresses. Save the booking.
Remember: The cashier records the request. Manager/Owner handles technician assignment and later service changes. Booking does not automatically mean the service has been paid.
Orders
How to use: Review incoming online and other recorded product orders. For a new online order, choose Confirm Order, Reschedule, or Decline as appropriate.

- Confirm Order: Accepts the current saved appointment too; a separate confirmation of the same schedule is unnecessary.
- Reschedule: Agree with the customer on a new time, select an available slot, and save it. Do this before field work starts.
- Decline / Cancel: Record a reason. Cancellation is restricted if delivery or installation has started or finished.
  Payments
  How to use: Review pending and recorded payments. Confirm cash only after actually collecting it. For a manual GCash/bank transfer, check the transaction outside the system before marking it paid.
  Completed Jobs History
  How to use: Look up work recorded as completed, including its related order/service information. This helps staff check previous installations and deliveries.
  Product Categories
  How to use: Create or manage the groups used to organize products (for example, types of aircon units).
  Products
  How to use: Add and update product names, brands, models, and categories.
  Product Variants
  How to use: Manage the different HP sizes, selling prices, promotional prices, and status for each product.
  Inventory
  How to use: Check available stock and record stock-in, stock-out, damage, returns, or adjustments with a reason. Do not change stock without recording the movement.
  Simple formula: Available stock = On-hand stock − Reserved stock.
  Stock Movements
  How to use: Review the history of stock changes to know what was added, sold, returned, or adjusted and who recorded it.
  Service Types
  How to use: Manage services offered by the business and their base prices. Check that the public website shows the same service options.
  Service Requests
  How to use: Review requests from customers and walk-in intake. Confirm or decline requests, adjust the appointment when allowed, review notes and payment status, and assign technicians.
  Technicians
  How to use: Create/manage technician profiles linked to authorized staff accounts. Update their availability status.
  Booking Calendar
  How to use: View appointment slots and scheduled bookings. The Manager/Owner can manage slots and dates; technicians use allowed schedule views.
  Schedules
  How to use: Review assignments and record availability, leave, meetings, or other unavailable time blocks. Check the schedule before assigning work.
  Assigned Work — Technician
  How to use: Open the assigned job, read customer contact and appointment details, contact the customer, and follow the available action:
- Start Delivery: For a delivery-only order when the work begins.
- Complete Delivery: After the delivery-only job is really finished.
- Start Service: For installation/service work when the technician actually begins.
- Complete Service: After finishing the job and entering the required completion notes.
- View History & Notes: Read previous activity and private staff notes when authorized.
  Important: Completed delivery must not be marked completed again. For an order with delivery and installation, the same crew may handle both, while the database keeps the stages separate for tracking.
  Customers
  How to use: View registered customers and their transaction summaries. Update account status when authorized.
  Feedback & Sentiment
  How to use: Read feedback and estimated Positive, Neutral, or Negative labels. Review the actual comment before making decisions.
  Facebook Agreements
  How to use: After talking with a customer in Messenger, manually enter the agreed product/service, address, schedule, and contact information. Management can then process the request.
  Remember: The system does not automatically import Facebook messages.
  Reports
  How to use: Check the recorded revenue or payment reports and export available records when needed.
  Remember: Paid revenue is not the same as net profit.
  Notifications
  How to use: Read internal updates relevant to the signed-in staff member and mark them as read.
  Archive
  How to use: View or restore locally archived items where offered.
  Current limitation: The inspected Archive implementation uses browser localStorage, not a central MySQL archive. It is not a reliable shared, permanent business archive.
  Staff Accounts
  How to use: Owner creates or updates staff accounts, chooses roles, and activates, disables, or suspends access.
  Audit Logs
  How to use: Owner reviews recorded staff actions in the database. These help identify who made a change and when.
  Capacity Calculator (Management)
  How to use: Estimate an aircon size for a customer. Use the result as guidance, not as a final engineering decision.

5. Meaning of common statuses
   Status Simple meaning
   PENDING Waiting for review, processing, or payment; check which section uses it
   CONFIRMED Staff accepted the request/order
   SCHEDULED Appointment is recorded and confirmed
   ASSIGNED Technician/team has been assigned
   IN_PROGRESS Work is currently being done
   COMPLETED Work/order has been recorded as finished
   CANCELLED / DECLINED Request/order was cancelled or not accepted
   PAID Payment was recorded as verified and received
   NEEDS REVIEW A status mismatch or problem requires a Manager to check it
   An order status, payment status, and technician-job status are different fields. For example, a scheduled order may still have a pending payment. Do not confuse them.

6. Four quick examples for new users
   Example A — Online aircon purchase: Customer opens Shop → adds product → checks out and selects a schedule → Manager confirms the order and saved appointment → Manager assigns a technician team → Technician performs the work → Payment is confirmed after collection.
   Example B — Online service request: Customer opens Services → enters service and aircon details → chooses an available slot → Manager reviews and assigns technicians → Technician starts and completes the service → Staff records the verified payment.
   Example C — Cashier walk-in relocation: Cashier opens POS → Walk-in Service → selects Aircon Relocation → records the pickup and destination addresses → selects an appointment → saves the booking → Manager reviews and assigns the team → Technician completes the relocation.
   Example D — Rescheduling: Manager opens the order → chooses Reschedule → contacts customer and selects an available new time → saves the appointment. If work has already started, the change is restricted to protect the work history.
