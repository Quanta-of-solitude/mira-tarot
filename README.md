# Mira's Tarot Room

An immersive 3D tarot reading. Mira shuffles, deals three cards, and reads the one you pick.
Three free readings per account, then paid question packs through Cashfree (UPI, cards, netbanking).

Built with Next.js (App Router) for Vercel, Three.js, Auth.js (email code sign-in), Neon Postgres,
and Cashfree. Readings are composed by the app itself, with no AI service.

## Run it locally (no accounts needed)

```bash
npm install
npm run dev
```

Needs Node 22. With no environment variables set, the app runs in a development mode:

- sign-in codes are shown on screen and in the server log instead of being emailed
- data lives in memory and resets when the server restarts
- the buy buttons report that payments are not set up

Each of those switches to the real thing as soon as its keys are present in `.env.local`
(see `.env.example` for every setting).

## Your admin access

`.env.local` sets `ADMIN_EMAILS` (your email) and `ADMIN_KEY` (a long random secret).
In the room, open **Sign in > I have an admin key**, and enter that email and key. You get unlimited
readings and an ADMIN button with test tools (force a card, skip the ritual and the cut).
This works even before email sending is set up. Once email is set up, signing in to your admin email
with a code also gives admin access.

## Deploy to Vercel

The smallest setup, for using it yourself:

1. Deploy the folder. Either push it to GitHub and import it at vercel.com/new, or run `npx vercel`
   inside this folder.
2. In the Vercel project: **Storage > Create Database > Neon (Postgres)**, connected to the project.
   This adds `DATABASE_URL`. The app creates its tables by itself on first use.
3. In **Settings > Environment Variables** add `AUTH_SECRET`, `ADMIN_EMAILS` and `ADMIN_KEY`
   (copy them from `.env.local`, or generate new ones). Redeploy.
4. Open the site and sign in with **I have an admin key**.

When you open it to other people, add:

- **Sign-in email:** users get a 6-digit code by email. Any SMTP account works. With Gmail: turn on
  2-step verification, create an app password at https://myaccount.google.com/apppasswords, and set
  `SMTP_USER` (your Gmail) and `SMTP_PASS` (the app password). Gmail allows about 500 emails a day.
- **Payments with Cashfree:** sign up at cashfree.com as an **Individual** with your personal PAN,
  Aadhaar (linked to your phone) and bank account; no GST or company is needed. Developers > API Keys
  gives `CASHFREE_APP_ID` and `CASHFREE_SECRET_KEY`. Test with the sandbox keys and `CASHFREE_ENV=sandbox`,
  then switch to the production keys and `CASHFREE_ENV=production` once activated. Fill in the bracketed
  details on `/terms`, `/privacy`, `/refunds` and `/contact` first, since Cashfree reviews the site.
  In Developers > Webhooks, add `https://YOUR_DOMAIN/api/pay/webhook` for payment events.
  Razorpay still works as an alternative: set its keys and `PAYMENT_PROVIDER=razorpay`.

## How the limits are enforced

- Every reading needs an account, verified by a code sent to that email address. Credits live in the database, never in the browser.
- The three cards are drawn on the server and stay there; the browser learns only the card it picked.
- Revealing a card and spending a credit happen in one atomic SQL statement (`lib/store.js`).
- New accounts get 3 free credits, unless the same device already claimed them under another account
  (a long-lived `mira_device` cookie). Someone with several email addresses and a cleared browser can
  still get 3 more; phone-number OTP sign-in is the stronger gate if that becomes a problem.
- Payments are credited only after the server asks Cashfree directly that the order is PAID (or verifies
  Razorpay's signature), exactly once per order, from either the checkout or the webhook.

## Where things are

| Path | What |
| --- | --- |
| `components/scene.js` | The 3D room, Mira, the cards and all animation |
| `components/TarotRoom.jsx` | The interface and the reading flow |
| `lib/tarot.js` | The deck, pack prices (`PACKS`), free credits (`FREE_CREDITS`) |
| `lib/oracle.js`, `lib/oracle-cards.js` | Mira's readings: how the question is read, and what each card says |
| `lib/store.js` | All database access |
| `app/api/pay/*`, `lib/cashfree.js` | Payment order, verification and webhook |
| `app/api/auth/code`, `lib/email.js` | Email sign-in codes |
| `lib/schema.mjs` | Tables (created automatically) |
