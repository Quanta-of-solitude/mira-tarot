import { site } from "@/lib/site";
import { PACKS, FREE_CREDITS } from "@/lib/tarot";

const rupees = (p) => `₹${Math.round(p.amount / 100)}`;
const prices = () => Object.values(PACKS).map((p) => `${rupees(p)} for ${p.credits} questions`).join(", ");

export const metadata = { title: "Contact · Mira's Tarot Room" };
export default function Contact() {
  const missing = [!site.owner && "BUSINESS_NAME", !site.phone && "BUSINESS_PHONE"].filter(Boolean);
  return (
    <article className="doc">
      <p><a href="/">← Back to the room</a></p>
      <h1>Contact</h1>
      {missing.length > 0 && <p className="todo">Set {missing.join(" and ")} in the hosting settings to complete this page.</p>}
      <p>Mira&apos;s Tarot Room is operated by {site.owner || "[your name]"}{site.address ? <>, {site.address}</> : null}, India.</p>
      <p>Email: {site.supportEmail || "[support email]"}</p>
      <p>Phone: {site.phone || "[phone number]"}</p>
      <p>We reply within two working days.</p>
    </article>
  );
}
