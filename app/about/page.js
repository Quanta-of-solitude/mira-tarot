import { FREE_CREDITS } from "@/lib/tarot";

export const metadata = { title: "About · Mira's Tarot Room" };
export default function About() {
  return (
    <article className="doc">
      <p><a href="/">← Back to the room</a></p>
      <h1>About Mira&apos;s Tarot Room</h1>
      <p>Mira&apos;s Tarot Room is an online tarot reading experience. You sit at Mira&apos;s candlelit table, ask one question, shuffle and cut the deck, and choose one of three cards.</p>
      <p>Each reading is composed from the card you draw, your question and the details you share: your sun sign, numerology and birth cards come from your date of birth, and the card&apos;s traditional astrology gives the timing. Every reading is kept in your private journal.</p>
      <p>Your first {FREE_CREDITS} readings are free. After that, readings are sold in small packs; see our <a href="/terms">Terms</a> for prices.</p>
      <p>Readings are for reflection and entertainment, not a substitute for professional advice.</p>
      <p>Questions? Visit our <a href="/contact">Contact</a> page.</p>
    </article>
  );
}
