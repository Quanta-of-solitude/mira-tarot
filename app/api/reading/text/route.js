import { currentUser, json } from "@/lib/session";
import { getReading, saveReadingText } from "@/lib/store";
import { readingStream } from "@/lib/reading";
import { DECK } from "@/lib/tarot";

export const maxDuration = 30;

// Streams Mira's reading for a picked card. Generated once, then served from the store.
export async function GET(req) {
  const u = await currentUser();
  if (!u) return json({ error: "signin" }, 401);
  const id = new URL(req.url).searchParams.get("id") || "";
  const r = await getReading(id, u.id);
  if (!r || r.status !== "picked") return json({ error: "Not found." }, 404);
  const headers = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" };
  if (r.text) return new Response(r.text, { headers });
  const picked = r.cards[r.picked];
  const stream = readingStream({
    question: r.question, card: DECK[picked.index], reversed: picked.reversed, name: u.displayName,
    others: r.cards.filter((_, i) => i !== r.picked), seed: r.id, profile: u.profile,
    onDone: (text) => saveReadingText(r.id, text),
  });
  return new Response(stream, { headers });
}
