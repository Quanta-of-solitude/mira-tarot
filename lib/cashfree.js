// Cashfree Payment Gateway (Orders API). Individuals can sign up with a personal PAN.
import { createHmac, timingSafeEqual } from "node:crypto";

export const cashfreeEnabled = !!(process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY);
export const cashfreeMode = process.env.CASHFREE_ENV === "production" ? "production" : "sandbox";
const BASE = () => (cashfreeMode === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg");

async function cf(path, init = {}) {
  const res = await fetch(BASE() + path, {
    ...init,
    headers: {
      "x-client-id": process.env.CASHFREE_APP_ID, "x-client-secret": process.env.CASHFREE_SECRET_KEY,
      "x-api-version": "2025-01-01", "Content-Type": "application/json", Accept: "application/json", ...init.headers,
    },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Cashfree ${res.status}: ${body.message || body.code || "request failed"}`);
  return body;
}

export function createOrder({ orderId, amountPaise, user, phone, returnUrl, notifyUrl, note }) {
  return cf("/orders", {
    method: "POST",
    headers: { "x-idempotency-key": crypto.randomUUID() },
    body: JSON.stringify({
      order_id: orderId, order_amount: amountPaise / 100, order_currency: "INR", order_note: note,
      customer_details: { customer_id: user.id, customer_email: user.email, customer_phone: phone, customer_name: user.displayName || undefined },
      order_meta: { return_url: returnUrl, ...(notifyUrl ? { notify_url: notifyUrl } : {}) },
    }),
  });
}

export const getOrder = (orderId) => cf(`/orders/${encodeURIComponent(orderId)}`);

// Signature = base64(HMAC-SHA256(timestamp + rawBody, secret key)).
export function validWebhook(raw, timestamp, signature) {
  if (!signature || !timestamp || !process.env.CASHFREE_SECRET_KEY) return false;
  const given = Buffer.from(String(signature));
  return [`${timestamp}${raw}`, `${timestamp}.${raw}`].some((msg) => {
    const exp = Buffer.from(createHmac("sha256", process.env.CASHFREE_SECRET_KEY).update(msg).digest("base64"));
    return exp.length === given.length && timingSafeEqual(exp, given);
  });
}
