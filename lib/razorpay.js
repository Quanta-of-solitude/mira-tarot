import Razorpay from "razorpay";
import { createHmac, timingSafeEqual } from "node:crypto";

export const paymentsEnabled = !!(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

export function razorpay() {
  return new Razorpay({ key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
}

export function validSignature(payload, signature, secret) {
  if (!secret || !signature) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(payload).digest("hex"));
  const given = Buffer.from(String(signature));
  return expected.length === given.length && timingSafeEqual(expected, given);
}
