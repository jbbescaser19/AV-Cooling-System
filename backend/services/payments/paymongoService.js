import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import connectDB from "../../utils/dbConn.js";
import { paymongoModel } from "../../models/payments/paymongoModel.js";
import { fulfillOrderReservation } from "../customer/order/stockReservationService.js";

const PROVIDER = "https://api.paymongo.com/v2/checkout_sessions";
const METHODS = { GCASH: "gcash", BANK_TRANSFER: "qrph" };
const READY = new Set(["CONFIRMED", "SCHEDULED", "IN_PROGRESS", "COMPLETED"]);
const messageError = (message, status = 409) =>
  Object.assign(new Error(message), { status });
const centavos = (amount) => Math.round(Number(amount) * 100);

function secrets() {
  const key = process.env.PAYMONGO_SECRET_KEY || "";
  const webhook = process.env.PAYMONGO_WEBHOOK_SECRET || "";
  if (!/^sk_(test|live)_/.test(key) || !webhook) {
    throw messageError(
      "PayMongo is not configured. Ask an Owner to finish merchant setup.",
      503,
    );
  }
  return { key, webhook, live: key.startsWith("sk_live_") };
}

export function paymongoConfigured() {
  return (
    /^sk_(test|live)_/.test(process.env.PAYMONGO_SECRET_KEY || "") &&
    Boolean(process.env.PAYMONGO_WEBHOOK_SECRET)
  );
}

function frontendOrigin() {
  const configured = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
  const url = new URL(configured);
  if (
    (process.env.NODE_ENV === "production" && url.protocol !== "https:") ||
    (url.protocol !== "https:" && url.protocol !== "http:")
  ) {
    throw messageError(
      "A secure frontend origin is required for PayMongo.",
      503,
    );
  }
  return url.origin;
}

function validCheckoutUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" && url.hostname === "checkout.paymongo.com"
    );
  } catch {
    return false;
  }
}

function validatePayment(payment) {
  if (!payment) throw messageError("Payment record was not found.", 404);
  if (!(payment.method in METHODS)) {
    throw messageError(
      "Choose GCash or QR Ph bank-app payment to pay online.",
      409,
    );
  }
  if (
    payment.paymentStatus !== "PENDING" ||
    payment.parentPaymentStatus !== "PENDING"
  ) {
    throw messageError("This payment is no longer pending.", 409);
  }
  if (!READY.has(payment.recordStatus)) {
    throw messageError(
      "Wait until AV Cooling confirms the order, schedule, and final price before paying.",
      409,
    );
  }
  if (
    !Number.isSafeInteger(centavos(payment.amount)) ||
    centavos(payment.amount) <= 0 ||
    centavos(payment.amount) !== centavos(payment.expectedAmount)
  ) {
    throw messageError(
      "The saved amount needs staff review before payment.",
      409,
    );
  }
}

/**
 * One hosted checkout per saved pending payment, for all channels.
 * The client supplies only an existing payment identifier, never the amount.
 */
export async function createHostedCheckout({ kind, identifier, actor }) {
  if (!["ORDER", "SERVICE"].includes(kind))
    throw messageError("Invalid payment type.", 400);
  const { key } = secrets();
  const paymentId = Number(identifier);
  const customerOrderReference =
    kind === "ORDER" && actor.type === "CUSTOMER"
      ? String(identifier || "")
      : null;
  if (
    !customerOrderReference &&
    (!Number.isSafeInteger(paymentId) || paymentId < 1)
  ) {
    throw messageError("Invalid payment reference.", 400);
  }
  const model = paymongoModel(connectDB);
  const payment =
    actor.type === "CUSTOMER"
      ? kind === "ORDER"
        ? await model.customerOrder(customerOrderReference, actor.id)
        : await model.customerService(paymentId, actor.id)
      : kind === "ORDER"
        ? await model.staffOrder(paymentId)
        : await model.staffService(paymentId);
  if (
    actor.type === "STAFF" &&
    actor.role === "SALES_CASHIER" &&
    !["POS", "POS_SERVICE"].includes(payment?.channel)
  ) {
    throw messageError(
      "Cashiers may create links only for POS sales and walk-in services.",
      403,
    );
  }
  validatePayment(payment);
  const payId = Number(payment.id);
  const total = centavos(payment.amount);
  const connection = await connectDB.getConnection();
  let current;
  try {
    await connection.beginTransaction();
    const tx = paymongoModel(connection);
    current = await tx.findByPayment(kind, payId, true);
    if (current) {
      if (
        Number(current.amount_centavos) !== total ||
        current.method_code !== payment.method
      ) {
        throw messageError(
          "Payment details changed. Contact the store before paying.",
          409,
        );
      }
      if (current.status === "ACTIVE" || current.status === "PAID") {
        if (current.status === "PAID")
          throw messageError("This payment is already paid.", 409);
        if (!validCheckoutUrl(current.checkout_url))
          throw messageError("Saved payment link needs review.", 409);
        await connection.commit();
        return {
          url: current.checkout_url,
          reused: true,
          reference: payment.reference,
        };
      }
      const elapsed = Date.now() - new Date(current.attempted_at).getTime();
      const firstAttemptAge =
        Date.now() - new Date(current.created_at).getTime();
      if (!Number.isFinite(elapsed) || elapsed < 120_000) {
        throw messageError(
          "A secure payment link is being prepared. Try again shortly.",
          409,
        );
      }
      if (firstAttemptAge > 23 * 60 * 60 * 1000) {
        throw messageError(
          "Payment link creation needs merchant reconciliation. Contact the store; do not pay twice.",
          409,
        );
      }
      await tx.retryCreating(current.checkout_id);
    } else {
      const requestKey = randomUUID();
      await tx.create(kind, payId, requestKey, total, payment.method);
      current = await tx.findByPayment(kind, payId, true);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    if (error.code === "ER_DUP_ENTRY")
      throw messageError(
        "The payment link is already being prepared. Refresh and try again.",
        409,
      );
    throw error;
  } finally {
    connection.release();
  }

  const origin = frontendOrigin();
  const payload = {
    data: {
      attributes: {
        line_items: [
          {
            name:
              kind === "ORDER"
                ? "AV Cooling product order"
                : "AV Cooling service booking",
            amount: total,
            currency: "PHP",
            quantity: 1,
          },
        ],
        payment_method_types: [METHODS[payment.method]],
        success_url: `${origin}/payment-return?result=returned`,
        cancel_url: `${origin}/payment-return?result=cancelled`,
        reference_number: `${kind}-${payId}`,
        metadata: { payment_kind: kind, local_payment_id: String(payId) },
        send_email_receipt: true,
        pass_on_fees: false,
      },
    },
  };

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 15000);
  let response;
  let json;
  try {
    response = await fetch(PROVIDER, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
        "Content-Type": "application/json",
        "Idempotency-Key": current.request_key,
      },
      body: JSON.stringify(payload),
      signal: abort.signal,
    });
    json = await response.json();
  } catch {
    throw messageError(
      "Payment provider is temporarily unavailable. The order is still unpaid. Retry later.",
      503,
    );
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    throw messageError(
      "PayMongo could not create a checkout. Check that this payment method is enabled for the merchant.",
      502,
    );
  }
  const data = json?.data;
  const url = data?.attributes?.checkout_url;
  if (!/^cs_/.test(String(data?.id || "")) || !validCheckoutUrl(url)) {
    throw messageError(
      "PayMongo returned an invalid checkout URL. Contact the store.",
      502,
    );
  }
  const activated = await paymongoModel(connectDB).markActive(
    current.checkout_id,
    data.id,
    url,
  );
  if (activated !== 1) {
    throw messageError(
      "The payment link was not saved. Contact the store before retrying.",
      503,
    );
  }
  return { url, reused: false, reference: payment.reference };
}

export function verifyPaymongoSignature(rawBody, signatureHeader) {
  const { webhook, live } = secrets();
  if (!Buffer.isBuffer(rawBody) || rawBody.length > 256 * 1024) return false;
  const parsed = Object.fromEntries(
    String(signatureHeader || "")
      .split(",")
      .map((item) => {
        const index = item.indexOf("=");
        return index > 0
          ? [item.slice(0, index).trim(), item.slice(index + 1).trim()]
          : ["", ""];
      }),
  );
  const timestamp = Number(parsed.t);
  if (
    !Number.isSafeInteger(timestamp) ||
    Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 600
  )
    return false;
  const supplied = live ? parsed.li : parsed.te;
  if (!/^[a-f0-9]{64}$/i.test(supplied || "")) return false;
  const expected = createHmac("sha256", webhook)
    .update(`${parsed.t}.`)
    .update(rawBody)
    .digest();
  const received = Buffer.from(supplied, "hex");
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}

/** Process only signed, exact-amount PayMongo paid webhooks. Safe on retries. */
export async function recordPaymongoPaidEvent(payload) {
  const { live } = secrets();
  // PayMongo publishes both a legacy event resource wrapper and a newer
  // send.webhook envelope. Both are accepted only after signature validation.
  const resource = payload?.data;
  const oldFormat = resource?.type === "event" && resource?.attributes;
  const attributes = oldFormat ? resource.attributes : resource;
  if (attributes?.type !== "checkout_session.payment.paid")
    return { ignored: true };
  if (
    typeof attributes.livemode !== "boolean" ||
    attributes.livemode !== live
  ) {
    throw messageError("PayMongo environment mismatch.", 400);
  }
  const session = attributes.data;
  const sessionId = session?.id;
  const attrs = session?.attributes;
  const paid = attrs?.payments?.find(
    (item) => (item?.attributes?.status || item?.status) === "paid",
  );
  if (
    !/^cs_/.test(String(sessionId || "")) ||
    !/^pay_/.test(String(paid?.id || ""))
  ) {
    throw messageError("Missing paid checkout session.", 400);
  }
  const eventId =
    oldFormat && /^evt_/.test(String(resource.id || ""))
      ? resource.id
      : `pm_${sessionId}_${paid.id}`;
  const paidAttrs = paid.attributes || paid;
  const total = Number(paidAttrs.amount);
  const methodType = paidAttrs.source?.type || paidAttrs.payment_method?.type;
  if (
    !Number.isSafeInteger(total) ||
    total <= 0 ||
    paidAttrs.currency !== "PHP"
  ) {
    throw messageError("Invalid paid amount or currency.", 400);
  }
  const connection = await connectDB.getConnection();
  try {
    await connection.beginTransaction();
    const model = paymongoModel(connection);
    const checkout = await model.lockBySession(sessionId);
    if (!checkout)
      throw messageError(
        "Payment session is not yet registered; retry webhook.",
        503,
      );
    if (checkout.status === "PAID") {
      await connection.commit();
      return { alreadyPaid: true };
    }
    if (
      checkout.status !== "ACTIVE" ||
      Number(checkout.amount_centavos) !== total ||
      METHODS[checkout.method_code] !== methodType
    ) {
      throw messageError(
        "Payment amount or method mismatch; needs reconciliation.",
        409,
      );
    }
    const kind = checkout.order_payment_id ? "ORDER" : "SERVICE";
    const paymentId = checkout.order_payment_id || checkout.service_payment_id;
    if (
      attrs.reference_number !== `${kind}-${paymentId}` ||
      attrs.metadata?.local_payment_id !== String(paymentId) ||
      attrs.metadata?.payment_kind !== kind
    ) {
      throw messageError(
        "Payment reference mismatch; needs reconciliation.",
        409,
      );
    }
    const payment =
      kind === "ORDER"
        ? await model.lockOrderPayment(paymentId)
        : await model.lockServicePayment(paymentId);
    if (
      !payment ||
      payment.status !== "PENDING" ||
      payment.parentStatus !== "PENDING" ||
      !READY.has(payment.orderStatus) ||
      payment.method !== checkout.method_code ||
      centavos(payment.amount) !== total ||
      centavos(payment.total) !== total
    ) {
      throw messageError(
        "Order or service payment changed; needs reconciliation.",
        409,
      );
    }
    if (!(await model.recordEvent(eventId, sessionId))) {
      await connection.commit();
      return { repeated: true };
    }
    const updated =
      kind === "ORDER"
        ? await model.markOrderPaid(paymentId, payment.parentId, paid.id)
        : await model.markServicePaid(paymentId, paid.id);
    if (!updated)
      throw messageError(
        "Payment state changed; reconciliation required.",
        409,
      );
    await model.markCheckoutPaid(checkout.checkout_id);
    await model.auditProviderPayment(kind, paymentId);
    // For POS take-home sales, stock was reserved when the sale was created.
    // A successful provider payment converts the reservation into physical stock-out.
    if (
      kind === "ORDER" &&
      payment.channel === "POS" &&
      payment.fulfillment === "PICKUP"
    ) {
      await fulfillOrderReservation(
        connection,
        payment.parentId,
        payment.creatorId,
      );
      await model.completePosPickup(payment.parentId);
    }
    await connection.commit();
    return { paid: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
