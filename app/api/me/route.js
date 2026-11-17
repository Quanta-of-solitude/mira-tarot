import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { currentUser, json } from "@/lib/session";
import { setDisplayName, listReadings } from "@/lib/store";
import { emailEnabled } from "@/lib/email";
import { paymentConfig } from "@/lib/payments";
import { PACKS, DECK } from "@/lib/tarot";

const pub = (u, last) => u && {
  email: u.email, name: u.displayName || null, image: u.image, credits: u.credits, isAdmin: u.isAdmin,
  lastCard: last ? DECK[last.cards[last.picked].index].name : null,
};

export async function GET() {
  // A long-lived device id, so one device can't collect free readings on many accounts.
  const jar = await cookies();
  if (!jar.get("mira_device")) {
    jar.set("mira_device", randomUUID(), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 400, path: "/" });
  }
  const u = await currentUser();
  const last = u ? (await listReadings(u.id, 1))[0] : null;
  return json({
    user: pub(u, last),
    config: {
      packs: Object.values(PACKS),
      payment: paymentConfig(),
      emailEnabled, adminKey: !!process.env.ADMIN_KEY, devCodes: !emailEnabled && process.env.NODE_ENV !== "production",
      supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || null,
    },
  });
}

export async function POST(req) {
  const u = await currentUser();
  if (!u) return json({ error: "signin" }, 401);
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").replace(/[^\p{L}\p{M} .'-]/gu, "").trim().slice(0, 30);
  if (!name) return json({ error: "Please enter a name." }, 400);
  const saved = await setDisplayName(u.id, name);
  return json({ user: pub({ ...saved, isAdmin: u.isAdmin }, null) });
}
