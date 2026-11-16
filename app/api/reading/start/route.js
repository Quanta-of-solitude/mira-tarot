import { currentUser, json } from "@/lib/session";
import { createReading } from "@/lib/store";
import { drawThree } from "@/lib/tarot";

// Deals three cards on the server. The client never learns them until it picks one.
export async function POST(req) {
  const u = await currentUser();
  if (!u) return json({ error: "signin" }, 401);
  const body = await req.json().catch(() => ({}));
  const question = String(body.question || "").trim().slice(0, 200);
  if (question.length < 4) return json({ error: "Please ask a longer question." }, 400);
  if (u.credits < 1 && !u.isAdmin) return json({ error: "credits" }, 402);
  const id = await createReading({ userId: u.id, question, cards: drawThree() });
  return json({ id });
}
