import { currentUser, json } from "@/lib/session";
import { listReadings } from "@/lib/store";
import { DECK } from "@/lib/tarot";

export async function GET() {
  const u = await currentUser();
  if (!u) return json({ error: "signin" }, 401);
  const rows = await listReadings(u.id, 30);
  return json({
    readings: rows.map((r) => {
      const c = r.cards[r.picked];
      return { id: r.id, question: r.question, card: DECK[c.index].name, reversed: c.reversed, text: r.text, createdAt: r.createdAt };
    }),
  });
}
