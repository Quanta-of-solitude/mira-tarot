import { randomBytes } from "node:crypto";
import { currentUser, json } from "@/lib/session";
import { createPayment } from "@/lib/store";
import { PACKS } from "@/lib/tarot";
import { provider } from "@/lib/payments";
import { razorpay } from "@/lib/razorpay";
import { createOrder } from "@/lib/cashfree";
import { mockOn, mockAllowed } from "@/lib/mockpay";

// Creates an order with the payment provider. The price comes from the server's pack table, never from the client.
export async function POST(req) {
  const u = await currentUser();
  if (!u) return json({ error: "signin" }, 401);
  const body = await req.json().catch(() => ({}));
  const pack = PACKS[body.pack];
  if (!pack) return json({ error: "Unknown pack." }, 400);
  if (mockOn()) {
    if (!mockAllowed(u)) return json({ error: "Payments are not set up yet." }, 503);
    const orderId = `test_${Date.now()}_${randomBytes(3).toString("hex")}`;
    await createPayment({ orderId, userId: u.id, pack: pack.id, amount: pack.amount, credits: pack.credits });
    return json({ provider: "mock", orderId, amount: pack.amount, label: pack.label });
  }
  const p = provider();
  if (!p) return json({ error: "Payments are not set up yet." }, 503);
  // The public address of the site: APP_URL if set (e.g. a tunnel to localhost), else the address the request came in on.
  const fwdHost = req.headers.get("x-forwarded-host"), fwdProto = req.headers.get("x-forwarded-proto");
  const origin = (process.env.APP_URL || (fwdHost ? `${fwdProto || "https"}://${fwdHost}` : new URL(req.url).origin)).replace(/\/$/, "");

  try {
    if (p === "cashfree") {
      const phone = String(body.phone || "").replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
      if (!/^[6-9]\d{9}$/.test(phone)) return json({ error: "Enter a 10-digit Indian mobile number." }, 400);
      const orderId = `mira_${Date.now()}_${randomBytes(3).toString("hex")}`;
      const order = await createOrder({
        orderId, amountPaise: pack.amount, user: u, phone, note: `${pack.label} - Mira's Tarot Room`,
        returnUrl: `${origin}/?order_id={order_id}`,
        notifyUrl: origin.startsWith("https://") ? `${origin}/api/pay/webhook` : null,
      });
      await createPayment({ orderId, userId: u.id, pack: pack.id, amount: pack.amount, credits: pack.credits });
      return json({ provider: p, orderId, paymentSessionId: order.payment_session_id });
    }
    const order = await razorpay().orders.create({ amount: pack.amount, currency: "INR", receipt: `mira_${Date.now()}`, notes: { userId: u.id, pack: pack.id } });
    await createPayment({ orderId: order.id, userId: u.id, pack: pack.id, amount: pack.amount, credits: pack.credits });
    return json({ provider: p, orderId: order.id, amount: pack.amount, key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, email: u.email, name: u.displayName || "" });
  } catch (err) {
    console.error(`${p}: order failed`, err);
    return json({ error: "Could not start the payment. Please try again." }, 502);
  }
}
