import { json } from "@/lib/session";
import { saveLoginCode, loginCodeSentAt } from "@/lib/store";
import { normEmail, newCode, hashCode, CODE_TTL_MIN, RESEND_AFTER_S } from "@/lib/logincode";
import { emailEnabled, sendLoginCode } from "@/lib/email";

const dev = process.env.NODE_ENV !== "production";

// Sends a 6-digit sign-in code to the email address.
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = normEmail(body.email);
  if (!email) return json({ error: "Enter a valid email address." }, 400);
  if (!emailEnabled && !dev) return json({ error: "Email sign-in is not set up yet." }, 503);
  const last = await loginCodeSentAt(email);
  if (last && Date.now() - new Date(last).getTime() < RESEND_AFTER_S * 1000) {
    return json({ error: "A code was just sent. Check your inbox, or try again in a minute." }, 429);
  }
  const code = newCode();
  await saveLoginCode(email, hashCode(email, code), new Date(Date.now() + CODE_TTL_MIN * 60000));
  if (!emailEnabled) {
    console.log(`[dev] sign-in code for ${email}: ${code}`);
    return json({ sent: true, devCode: code });
  }
  try { await sendLoginCode(email, code); }
  catch (err) { console.error("email: send failed", err); return json({ error: "We couldn't send the email. Try again shortly." }, 502); }
  return json({ sent: true });
}
