import { site } from "@/lib/site";
import { PACKS, FREE_CREDITS } from "@/lib/tarot";

const rupees = (p) => `₹${Math.round(p.amount / 100)}`;
const prices = () => Object.values(PACKS).map((p) => `${rupees(p)} for ${p.credits} questions`).join(", ");

export const metadata = { title: "Privacy · Mira's Tarot Room" };
export default function Privacy() {
  return (
    <article className="doc">
      <p><a href="/">← Back to the room</a></p>
      <h1>Privacy Policy</h1>
      <p>This policy explains what Mira&apos;s Tarot Room{site.owner ? `, operated by ${site.owner},` : ""} collects and why.</p>
      <h2>What we collect</h2>
      <p>Your email address; the name you ask Mira to call you; the details you give for your readings (date of birth, and optionally where you were born, where you live, your work and your relationship status); the questions you ask and the readings you receive; your purchases; and a device identifier cookie used to prevent abuse of free readings.</p>
      <h2>How we use it</h2>
      <p>To compose your readings (your date of birth gives your sun sign, numerology and birth cards), keep your journal, process payments and prevent abuse. We do not sell your data or show you advertising.</p>
      <h2>Payments</h2>
      <p>Payments are handled by our payment partner, Cashfree Payments, which also receives the mobile number you enter at checkout. We never see or store your card, UPI or bank details.</p>
      <h2>Your choices</h2>
      <p>Write to {site.supportEmail || "[support email]"} to see, correct or delete your data. We act on requests within 30 days.</p>
    </article>
  );
}
