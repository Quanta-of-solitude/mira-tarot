import nodemailer from "nodemailer";

// Any SMTP account works. With Gmail: SMTP_HOST=smtp.gmail.com, SMTP_PORT=465,
// SMTP_USER=you@gmail.com, SMTP_PASS=<16-character app password>.
export const emailEnabled = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transport = null;
function mailer() {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 465);
    transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  }
  return transport;
}

export async function sendLoginCode(to, code) {
  const from = process.env.EMAIL_FROM || `Mira's Tarot Room <${process.env.SMTP_USER}>`;
  await mailer().sendMail({
    from, to,
    subject: `${code} is your code for Mira's Tarot Room`,
    text: `Your sign-in code is ${code}\n\nIt expires in 10 minutes. If you didn't ask for it, you can ignore this email.`,
    html: `<div style="font-family:Georgia,serif;background:#140b10;color:#eadfca;padding:32px;border-radius:12px;max-width:420px">
      <p style="letter-spacing:.2em;color:#cfa45c;font-size:12px;margin:0">MIRA'S TAROT ROOM</p>
      <p style="font-size:16px">Your sign-in code is</p>
      <p style="font-size:36px;letter-spacing:.3em;color:#f5dcaa;margin:8px 0">${code}</p>
      <p style="font-size:13px;color:#a8958f">It expires in 10 minutes. If you didn't ask for it, you can ignore this email.</p></div>`,
  });
}
