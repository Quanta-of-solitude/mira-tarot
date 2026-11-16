import { creditPayment, getPayment } from "@/lib/store";
import { validSignature } from "@/lib/razorpay";
import { validWebhook, getOrder } from "@/lib/cashfree";

// Server-to-server notice from the payment provider: the safety net for payments where the
// browser closed before /api/pay/verify ran. creditPayment is idempotent.
export async function POST(req) {
  const raw = await req.text();

  const cfSig = req.headers.get("x-webhook-signature");
  if (cfSig) {
    if (!validWebhook(raw, req.headers.get("x-webhook-timestamp"), cfSig)) return new Response("bad signature", { status: 400 });
    const orderId = JSON.parse(raw)?.data?.order?.order_id;
    if (orderId && (await getPayment(orderId))) {
      // Confirm with Cashfree rather than trusting the event type.
      const order = await getOrder(orderId).catch(() => null);
      if (order?.order_status === "PAID") await creditPayment({ orderId, paymentId: String(order.cf_order_id || "") });
    }
    return new Response("ok");
  }

  if (!validSignature(raw, req.headers.get("x-razorpay-signature"), process.env.RAZORPAY_WEBHOOK_SECRET)) {
    return new Response("bad signature", { status: 400 });
  }
  const event = JSON.parse(raw);
  if (event.event === "payment.captured" || event.event === "order.paid") {
    const pay = event.payload?.payment?.entity;
    if (pay?.order_id && (await getPayment(pay.order_id))) await creditPayment({ orderId: pay.order_id, paymentId: pay.id });
  }
  return new Response("ok");
}
