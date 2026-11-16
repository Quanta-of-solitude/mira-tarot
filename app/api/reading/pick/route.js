import { currentUser, json } from "@/lib/session";
import { getReading, pickReading } from "@/lib/store";
import { DECK } from "@/lib/tarot";

// Reveals the chosen card and spends one credit, atomically.
export async function POST(req) {
  const u = await currentUser();
  if (!u) return json({ error: "signin" }, 401);
  const body = await req.json().catch(() => ({}));
  const pick = Number(body.pick);
  if (![0, 1, 2].includes(pick)) return json({ error: "Bad pick." }, 400);
  const id = String(body.id || "");

  // Admin test tool: force the card and/or orientation that will be revealed.
  let cards = null;
  if (u.isAdmin && body.force) {
    const r = await getReading(id, u.id);
    if (r) {
      cards = r.cards.map((c) => ({ ...c }));
      const fi = Number(body.force.index);
      if (Number.isInteger(fi) && DECK[fi]) cards[pick].index = fi;
      if (body.force.orient === "up") cards[pick].reversed = false;
      if (body.force.orient === "rev") cards[pick].reversed = true;
    }
  }

  const res = await pickReading({ id, userId: u.id, pick, cost: u.isAdmin ? 0 : 1, cards });
  if (!res) {
    const r = await getReading(id, u.id);
    if (!r || r.status !== "dealt") return json({ error: "This reading is no longer open." }, 409);
    return json({ error: "credits" }, 402);
  }
  return json({ card: res.reading.cards[pick], credits: res.credits });
}
