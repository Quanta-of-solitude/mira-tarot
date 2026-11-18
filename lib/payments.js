import { cashfreeEnabled, cashfreeMode } from "./cashfree";
import { paymentsEnabled as razorpayEnabled } from "./razorpay";
import { mockOn, mockAllowed } from "./mockpay";

// PAYMENT_PROVIDER picks one explicitly; otherwise whichever has keys, Cashfree first.
export function provider() {
  const want = (process.env.PAYMENT_PROVIDER || "").toLowerCase();
  if (want === "mock") return null; // test payments are handled per user, see paymentConfig
  if (want === "razorpay") return razorpayEnabled ? "razorpay" : null;
  if (want === "cashfree") return cashfreeEnabled ? "cashfree" : null;
  return cashfreeEnabled ? "cashfree" : razorpayEnabled ? "razorpay" : null;
}
// u: the signed-in user. Test payments (lib/mockpay.js) are offered only to the testers listed there.
export const paymentConfig = (u) => {
  if (mockOn()) return mockAllowed(u) ? { provider: "mock" } : null;
  const p = provider();
  return p === "cashfree" ? { provider: p, mode: cashfreeMode } : p === "razorpay" ? { provider: p, key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID } : null;
};
