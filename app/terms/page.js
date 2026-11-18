import { site } from "@/lib/site";
import { PACKS, FREE_CREDITS } from "@/lib/tarot";

const rupees = (p) => `₹${Math.round(p.amount / 100)}`;
const prices = () => Object.values(PACKS).map((p) => `${rupees(p)} for ${p.credits} questions`).join(", ");

export const metadata = { title: "Terms · Mira's Tarot Room" };
export default function Terms() {
  const missing = !site.owner || !site.address;
  return (
    <article className="doc">
      <p><a href="/">← Back to the room</a></p>
      <h1>Terms of Use</h1>
      {missing && <p className="todo">Set BUSINESS_NAME and BUSINESS_ADDRESS in the hosting settings to complete this page.</p>}
      <p>Mira&apos;s Tarot Room is operated by {site.owner || "[your name]"}, {site.address || "[address]"}, India. By using this site you agree to these terms.</p>
      <h2>Entertainment only</h2>
      <p>Readings are for reflection and entertainment. They are not predictions of fact and are not medical, legal, financial or psychological advice. Do not make important decisions based on a reading.</p>
      <h2>Accounts</h2>
      <p>You sign in with your email address. You must be 18 or older. One account per person; we may withhold free readings from duplicate accounts.</p>
      <h2>Prices and payment</h2>
      <p>New accounts receive {FREE_CREDITS} free questions. Further questions are sold in packs: {prices()}. Prices are in Indian Rupees and include all taxes. Payments are processed by our payment partner, Cashfree Payments. Purchased questions are added to your account immediately and do not expire.</p>
      <h2>Refunds and delivery</h2>
      <p>See our <a href="/refunds">Refund and Cancellation Policy</a> and <a href="/delivery">Delivery Policy</a>.</p>
      <h2>Acceptable use</h2>
      <p>Do not misuse the service, attempt to bypass limits, or submit unlawful content.</p>
      <h2>Governing law</h2>
      <p>These terms are governed by the laws of India.</p>
      <h2>Changes</h2>
      <p>We may update these terms; continued use means you accept the updated terms.</p>
      <h2>Contact</h2>
      <p>{site.supportEmail || "[support email]"}</p>
    </article>
  );
}
