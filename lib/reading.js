// Mira's reading, composed from the card and the question (lib/oracle.js), streamed
// sentence by sentence so it arrives the way she speaks it.
import { composeReading } from "./oracle";
import { fallbackReading } from "./tarot";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function readingStream({ question, card, reversed, name, others, seed, profile, today, onDone }) {
  const enc = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      let text;
      try { text = composeReading({ question, card, reversed, name, others, seed, profile, today }); }
      catch (err) { console.error("reading: compose failed", err); text = fallbackReading(card, reversed, question); }
      const pieces = text.match(/[^.!?:\n]+[.!?:]+["”']?\s*|\n+|[^.!?:\n]+$/g) || [text];
      for (const p of pieces) { controller.enqueue(enc.encode(p)); if (p.trim()) await sleep(120); }
      try { await onDone?.(text); } catch (err) { console.error("reading: could not save", err); }
      controller.close();
    },
  });
}
