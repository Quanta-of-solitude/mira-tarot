import { currentUser, json } from "@/lib/session";
import { creditPayment, getPayment, getUser } from "@/lib/store";
import { validSignature } from "@/lib/razorpay";
import { getOrder } from "@/lib/cashfree";
import { judge, mockAllowed } from "@/lib/mockpay";

// Called by the browser after checkout. Credits are added only when the provider confirms the payment.
export async function POST(req) {
  const u = await currentUser();
  if (!u) return json({ error: "signin" }, 401);
  const b = await req.json().catch(() => ({}));

  if (b.razorpay_order_id) {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = b;
    if (!validSignature(`${orderId}|${paymentId}`, signature, process.env.RAZORPAY_KEY_SECRET)) return json({ error: "Payment could not be verified." }, 400);
    const p = await getPayment(orderId);
    if (!p || p.userId !== u.id) return json({ error: "Order not found." }, 404);
    await creditPayment({ orderId, paymentId });
    return json({ paid: true, credits: (await getUser(u.id)).credits });
  }

  const orderId = String(b.orderId || "");
  const p = await getPayment(orderId);
  if (!p || p.userId !== u.id) return json({ error: "Order not found." }, 404);

  // Test payments: approved or declined by the test values, never by real money.
  if (orderId.startsWith("test_")) {
    if (!mockAllowed(u)) return json({ error: "Test payments are off." }, 403);
    if (p.status !== "paid") {
      const r = judge(b.mock || {});
      if (!r.paid) return json({ paid: false, reason: r.reason, credits: u.credits });
      await creditPayment({ orderId, paymentId: `test_pay_${Date.now()}` });
    }
    return json({ paid: true, credits: (await getUser(u.id)).credits });
  }
  if (p.status !== "paid") {
    try {
      const order = await getOrder(orderId);
      if (order.order_status !== "PAID") return json({ paid: false, status: order.order_status, credits: u.credits });
      await creditPayment({ orderId, paymentId: String(order.cf_order_id || "") });
    } catch (err) {
      console.error("cashfree: status check failed", err);
      return json({ error: "We couldn't confirm the payment yet. If money was deducted, your questions will appear within a few minutes." }, 502);
    }
  }
  return json({ paid: true, credits: (await getUser(u.id)).credits });
}
