import { site } from "@/lib/site";
import { PACKS, FREE_CREDITS } from "@/lib/tarot";

const rupees = (p) => `₹${Math.round(p.amount / 100)}`;
const prices = () => Object.values(PACKS).map((p) => `${rupees(p)} for ${p.credits} questions`).join(", ");

export const metadata = { title: "Refunds · Mira's Tarot Room" };
export default function Refunds() {
  const email = site.supportEmail || "[support email]";
  return (
    <article className="doc">
      <p><a href="/">← Back to the room</a></p>
      <h1>Refund and Cancellation Policy</h1>
      <p>Question packs ({prices()}) are digital services delivered instantly to your account.</p>
      <h2>Refunds</h2>
      <p>Unused packs can be cancelled and refunded in full within 7 days of purchase. Questions that have already been used are not refundable.</p>
      <p>If you were charged but did not receive your questions, or were charged twice, write to {email} with your payment ID. Verified cases are refunded in full.</p>
      <h2>How refunds are paid</h2>
      <p>Approved refunds are made to the original payment method within 5 to 7 working days.</p>
      <h2>Contact</h2>
      <p>{email}</p>
    </article>
  );
}
