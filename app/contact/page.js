export const metadata = { title: "Contact · Mira's Tarot Room" };
export default function Contact() {
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  return (
    <article className="doc">
      <p><a href="/">← Back to the room</a></p>
      <h1>Contact</h1>
      <p className="todo">Template. Payment gateways require your name (or business name), address and a working contact.</p>
      <p>[Your business name]<br />[Registered address], India</p>
      <p>Email: {email || "[support email]"}</p>
      <p>We reply within two working days.</p>
    </article>
  );
}
