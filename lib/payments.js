import { cashfreeEnabled, cashfreeMode } from "./cashfree";
import { paymentsEnabled as razorpayEnabled } from "./razorpay";

// PAYMENT_PROVIDER picks one explicitly; otherwise whichever has keys, Cashfree first.
export function provider() {
  const want = (process.env.PAYMENT_PROVIDER || "").toLowerCase();
  if (want === "razorpay") return razorpayEnabled ? "razorpay" : null;
  if (want === "cashfree") return cashfreeEnabled ? "cashfree" : null;
  return cashfreeEnabled ? "cashfree" : razorpayEnabled ? "razorpay" : null;
}
export const paymentConfig = () => {
  const p = provider();
  return p === "cashfree" ? { provider: p, mode: cashfreeMode } : p === "razorpay" ? { provider: p, key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID } : null;
};
