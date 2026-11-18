import { site } from "@/lib/site";
import { PACKS, FREE_CREDITS } from "@/lib/tarot";

const rupees = (p) => `₹${Math.round(p.amount / 100)}`;
const prices = () => Object.values(PACKS).map((p) => `${rupees(p)} for ${p.credits} questions`).join(", ");

export const metadata = { title: "Contact · Mira's Tarot Room" };
export default function Contact() {
  const missing = !site.owner || !site.address;
  return (
    <article className="doc">
      <p><a href="/">← Back to the room</a></p>
      <h1>Contact</h1>
      {missing && <p className="todo">Set BUSINESS_NAME and BUSINESS_ADDRESS in the hosting settings to complete this page.</p>}
      <p>{site.owner || "[your name]"}<br />{site.address || "[address]"}, India</p>
      <p>Email: {site.supportEmail || "[support email]"}</p>
      {site.phone && <p>Phone: {site.phone}</p>}
      <p>We reply within two working days.</p>
    </article>
  );
}
