import { site } from "@/lib/site";
import { PACKS, FREE_CREDITS } from "@/lib/tarot";

const rupees = (p) => `₹${Math.round(p.amount / 100)}`;
const prices = () => Object.values(PACKS).map((p) => `${rupees(p)} for ${p.credits} questions`).join(", ");

export const metadata = { title: "Delivery · Mira's Tarot Room" };
export default function Delivery() {
  return (
    <article className="doc">
      <p><a href="/">← Back to the room</a></p>
      <h1>Shipping and Delivery Policy</h1>
      <p>Mira&apos;s Tarot Room sells digital services only. Nothing is shipped.</p>
      <p>When your payment succeeds, your questions are added to your account immediately and you can use them right away on this website. Your readings are kept in your journal.</p>
      <p>If your questions do not appear within 30 minutes of a successful payment, write to {site.supportEmail || "[support email]"} with your payment ID and we will fix it or refund you in full.</p>
    </article>
  );
}
