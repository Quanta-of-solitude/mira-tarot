// Test payments: a built-in checkout that approves or declines by test values, with no real money and no
// payment company. Turned on with PAYMENT_PROVIDER=mock, and only ever offered to the email addresses in
// MOCK_PAY_EMAILS (or ADMIN_EMAILS when that is empty). MOCK_PAY_EMAILS=* offers them to everyone, which
// lets anyone add free questions: use it only while testing.

const list = (v) => (v || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
export const mockOn = () => (process.env.PAYMENT_PROVIDER || "").toLowerCase() === "mock";
export const mockAllowed = (u) => {
  if (!mockOn() || !u?.email) return false;
  const testers = list(process.env.MOCK_PAY_EMAILS);
  if (testers.includes("*")) return true; // "*" opens test payments to every signed-in user
  return (testers.length ? testers : list(process.env.ADMIN_EMAILS)).includes(u.email.toLowerCase());
};

// The test values. Anything else is rejected, the way a real gateway rejects an invalid payment.
export const TEST = {
  upiOk: "success@test", upiFail: "failure@test",
  cardOk: "4111111111111111", cardDecline: "4000000000000002", otp: "123456",
};

// Returns { paid: true } or { paid: false, reason }.
export function judge({ method, upi, card, expiry, cvv, otp }) {
  if (method === "upi") {
    const id = String(upi || "").trim().toLowerCase();
    if (id === TEST.upiOk) return { paid: true };
    if (id === TEST.upiFail) return { paid: false, reason: "The payment was declined by the bank (test failure)." };
    return { paid: false, reason: `In test mode, use ${TEST.upiOk} to approve or ${TEST.upiFail} to decline.` };
  }
  if (method === "card") {
    const num = String(card || "").replace(/\D/g, "");
    const m = String(expiry || "").match(/^(\d{2})\s*\/\s*(\d{2})$/);
    if (!m || +m[1] < 1 || +m[1] > 12) return { paid: false, reason: "Enter the expiry as MM/YY." };
    const now = new Date(), y = 2000 + +m[2];
    if (y < now.getFullYear() || (y === now.getFullYear() && +m[1] < now.getMonth() + 1)) return { paid: false, reason: "This card has expired." };
    if (!/^\d{3}$/.test(String(cvv || ""))) return { paid: false, reason: "Enter the 3-digit CVV." };
    if (num === TEST.cardDecline) return { paid: false, reason: "The card was declined (test decline)." };
    if (num !== TEST.cardOk) return { paid: false, reason: `In test mode, use card ${TEST.cardOk} to approve or ${TEST.cardDecline} to decline.` };
    if (String(otp || "") !== TEST.otp) return { paid: false, reason: `Wrong OTP. In test mode the OTP is ${TEST.otp}.` };
    return { paid: true };
  }
  return { paid: false, reason: "Choose UPI or card." };
}
