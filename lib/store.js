// Data access. Postgres (Neon) when DATABASE_URL is set; an in-memory store for local
// development otherwise. Credits only ever change here, in single atomic statements.
import { neon } from "@neondatabase/serverless";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { FREE_CREDITS } from "./tarot";
import { SCHEMA } from "./schema.mjs";

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
export const usingMemory = !sql;
const mem = (globalThis.__miraMem ||= { users: new Map(), devices: new Map(), readings: new Map(), payments: new Map(), codes: new Map() });

// Creates the tables on first use, once per server instance. Every statement is idempotent.
let migrated = null;
async function guard() {
  if (!sql) {
    if (process.env.NODE_ENV === "production") throw new Error("DATABASE_URL is not set. Add a Neon Postgres database in Vercel > Storage.");
    return;
  }
  migrated ||= (async () => { for (const st of SCHEMA.split(";").map((x) => x.trim()).filter(Boolean)) await sql.query(st); })()
    .catch((err) => { migrated = null; throw err; });
  await migrated;
}
const U = (r) => r && { id: r.id, email: r.email, name: r.name, displayName: r.display_name, image: r.image, credits: r.credits };
const R = (r) => r && { id: r.id, userId: r.user_id, question: r.question, cards: r.cards, picked: r.picked, status: r.status, text: r.reading_text, createdAt: r.created_at };

export async function upsertUser({ email, name, image, deviceId }) {
  await guard();
  if (sql) {
    const ex = await sql`update users set name = coalesce(${name ?? null}, name), image = coalesce(${image ?? null}, image) where email = ${email} returning *`;
    if (ex[0]) return U(ex[0]);
    // A device that already claimed free readings under another account gets none.
    let free = FREE_CREDITS;
    if (deviceId) { const d = await sql`select 1 from devices where device_id = ${deviceId}`; if (d.length) free = 0; }
    const ins = await sql`insert into users (email, name, image, credits) values (${email}, ${name ?? null}, ${image ?? null}, ${free})
      on conflict (email) do update set name = coalesce(excluded.name, users.name) returning *`;
    if (deviceId) await sql`insert into devices (device_id, user_id) values (${deviceId}, ${ins[0].id}) on conflict do nothing`;
    return U(ins[0]);
  }
  let u = [...mem.users.values()].find((x) => x.email === email);
  if (!u) {
    let free = FREE_CREDITS;
    if (deviceId && mem.devices.has(deviceId)) free = 0;
    u = { id: randomUUID(), email, name: name ?? null, display_name: null, image: image ?? null, credits: free };
    mem.users.set(u.id, u);
    if (deviceId) mem.devices.set(deviceId, u.id);
  }
  return U(u);
}

export async function getUser(id) {
  await guard();
  if (sql) return U((await sql`select * from users where id = ${id}`)[0]);
  return U(mem.users.get(id));
}

export async function setDisplayName(id, displayName) {
  await guard();
  if (sql) return U((await sql`update users set display_name = ${displayName} where id = ${id} returning *`)[0]);
  const u = mem.users.get(id); if (u) u.display_name = displayName; return U(u);
}

export async function createReading({ userId, question, cards }) {
  await guard();
  if (sql) return (await sql`insert into readings (user_id, question, cards) values (${userId}, ${question}, ${JSON.stringify(cards)}::jsonb) returning id`)[0].id;
  const id = randomUUID();
  mem.readings.set(id, { id, user_id: userId, question, cards, picked: null, status: "dealt", reading_text: null, created_at: new Date().toISOString() });
  return id;
}

export async function getReading(id, userId) {
  await guard();
  if (sql) return R((await sql`select * from readings where id = ${id} and user_id = ${userId}`)[0]);
  const r = mem.readings.get(id); return r && r.user_id === userId ? R(r) : null;
}

// Marks the reading as picked and spends one credit in the same statement, so a reading
// can never be revealed without paying for it, and two parallel requests can't both win.
// Returns { reading, credits } or null (no such dealt reading, or not enough credits).
export async function pickReading({ id, userId, pick, cost, cards }) {
  await guard();
  if (sql) {
    const rows = await sql`
      with r as (select id from readings where id = ${id} and user_id = ${userId} and status = 'dealt'),
      u as (update users set credits = credits - ${cost} where id = ${userId} and credits >= ${cost} and exists (select 1 from r) returning credits),
      upd as (update readings set status = 'picked', picked = ${pick}, cards = coalesce(${cards ? JSON.stringify(cards) : null}::jsonb, cards)
              where id in (select id from r) and exists (select 1 from u) returning *)
      select upd.*, (select credits from u) as credits_left from upd`;
    return rows[0] ? { reading: R(rows[0]), credits: rows[0].credits_left } : null;
  }
  const r = mem.readings.get(id), u = mem.users.get(userId);
  if (!r || r.user_id !== userId || r.status !== "dealt" || !u || u.credits < cost) return null;
  u.credits -= cost; r.status = "picked"; r.picked = pick; if (cards) r.cards = cards;
  return { reading: R(r), credits: u.credits };
}

export async function saveReadingText(id, text) {
  await guard();
  if (sql) { await sql`update readings set reading_text = ${text} where id = ${id}`; return; }
  const r = mem.readings.get(id); if (r) r.reading_text = text;
}

export async function listReadings(userId, limit = 20) {
  await guard();
  if (sql) return (await sql`select * from readings where user_id = ${userId} and status = 'picked' order by created_at desc limit ${limit}`).map(R);
  return [...mem.readings.values()].filter((r) => r.user_id === userId && r.status === "picked").sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, limit).map(R);
}

export async function createPayment({ orderId, userId, pack, amount, credits }) {
  await guard();
  if (sql) { await sql`insert into payments (order_id, user_id, pack, amount, credits) values (${orderId}, ${userId}, ${pack}, ${amount}, ${credits})`; return; }
  mem.payments.set(orderId, { order_id: orderId, user_id: userId, pack, amount, credits, status: "created" });
}

export async function getPayment(orderId) {
  await guard();
  if (sql) { const p = (await sql`select * from payments where order_id = ${orderId}`)[0]; return p && { orderId: p.order_id, userId: p.user_id, status: p.status, credits: p.credits }; }
  const p = mem.payments.get(orderId); return p && { orderId: p.order_id, userId: p.user_id, status: p.status, credits: p.credits };
}

// Idempotent: the checkout callback and the webhook may both report the same payment;
// credits are added exactly once.
export async function creditPayment({ orderId, paymentId }) {
  await guard();
  if (sql) {
    const rows = await sql`
      with p as (update payments set status = 'paid', payment_id = ${paymentId}, credited_at = now()
                 where order_id = ${orderId} and status <> 'paid' returning user_id, credits)
      update users set credits = users.credits + p.credits from p where users.id = p.user_id returning users.credits`;
    return { credited: rows.length > 0 };
  }
  const p = mem.payments.get(orderId);
  if (!p || p.status === "paid") return { credited: false };
  p.status = "paid"; p.payment_id = paymentId; mem.users.get(p.user_id).credits += p.credits;
  return { credited: true };
}

/* ---------- email sign-in codes ---------- */
export async function saveLoginCode(email, codeHash, expiresAt) {
  await guard();
  if (sql) {
    await sql`insert into login_codes (email, code_hash, expires_at, attempts, sent_at) values (${email}, ${codeHash}, ${expiresAt.toISOString()}, 0, now())
      on conflict (email) do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, sent_at = now()`;
    return;
  }
  mem.codes.set(email, { code_hash: codeHash, expires_at: expiresAt, attempts: 0, sent_at: new Date() });
}

export async function loginCodeSentAt(email) {
  await guard();
  if (sql) return (await sql`select sent_at from login_codes where email = ${email}`)[0]?.sent_at || null;
  return mem.codes.get(email)?.sent_at || null;
}

// True once for a correct, unexpired code; each try counts against MAX_ATTEMPTS.
export async function consumeLoginCode(email, codeHash) {
  await guard();
  let row;
  if (sql) row = (await sql`update login_codes set attempts = attempts + 1 where email = ${email} returning code_hash, expires_at, attempts`)[0];
  else { row = mem.codes.get(email); if (row) row.attempts++; }
  if (!row || row.attempts > 5 || new Date(row.expires_at).getTime() < Date.now()) return false;
  const a = Buffer.from(row.code_hash), b = Buffer.from(codeHash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  if (sql) await sql`delete from login_codes where email = ${email}`; else mem.codes.delete(email);
  return true;
}
