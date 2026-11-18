// The traditional systems a tarot reader works with, so each reading rests on the querent's own chart:
// - Golden Dawn correspondences: every Major Arcana card belongs to a zodiac sign, a planet or an element.
// - Elemental dignities: how the card's element meets the querent's sun-sign element.
// - Numerology: life path, personal year and personal month numbers.
// - Birth cards (Mary K. Greer's method): the Major Arcana cards of a birth date.
// - Timing: a sign card points to that sign's season; a planet card to its own rhythm (the Moon's phases,
//   Saturn's slowness...). All dates are worked out in Indian time.

const DAY = 86400000;

export const SIGNS = [
  // name, Hindi name (rashi), start [month, day], element, ruler
  ["Aries", "Mesha", [3, 21], "fire", "Mars"],
  ["Taurus", "Vrishabha", [4, 20], "earth", "Venus"],
  ["Gemini", "Mithuna", [5, 21], "air", "Mercury"],
  ["Cancer", "Karka", [6, 21], "water", "Moon"],
  ["Leo", "Simha", [7, 23], "fire", "Sun"],
  ["Virgo", "Kanya", [8, 23], "earth", "Mercury"],
  ["Libra", "Tula", [9, 23], "air", "Venus"],
  ["Scorpio", "Vrishchika", [10, 23], "water", "Mars"],
  ["Sagittarius", "Dhanu", [11, 22], "fire", "Jupiter"],
  ["Capricorn", "Makara", [12, 22], "earth", "Saturn"],
  ["Aquarius", "Kumbha", [1, 20], "air", "Saturn"],
  ["Pisces", "Meena", [2, 19], "water", "Jupiter"],
].map(([name, hindi, start, element, ruler], i) => ({ i, name, hindi, start, element, ruler }));
const sign = (name) => SIGNS.find((s) => s.name === name);

export const WEEKDAY = { Sun: "Sunday", Moon: "Monday", Mars: "Tuesday", Mercury: "Wednesday", Jupiter: "Thursday", Venus: "Friday", Saturn: "Saturday" };

// Golden Dawn attributions, in Major Arcana order. Uranus, Neptune and Pluto are the modern rulers of the
// three elemental trumps; their weekday comes from the element's traditional planet.
export const CARD_ASTRO = [
  { kind: "element", element: "air", planet: "Uranus", day: "Mercury", note: "the element of air, ruled in modern tarot by Uranus, the planet of surprises" },
  { kind: "planet", planet: "Mercury", element: "air" },
  { kind: "planet", planet: "Moon", element: "water" },
  { kind: "planet", planet: "Venus", element: "earth" },
  { kind: "sign", sign: "Aries" },
  { kind: "sign", sign: "Taurus" },
  { kind: "sign", sign: "Gemini" },
  { kind: "sign", sign: "Cancer" },
  { kind: "sign", sign: "Leo" },
  { kind: "sign", sign: "Virgo" },
  { kind: "planet", planet: "Jupiter", element: "fire" },
  { kind: "sign", sign: "Libra" },
  { kind: "element", element: "water", planet: "Neptune", day: "Moon", note: "the element of water, ruled in modern tarot by Neptune, the planet of surrender" },
  { kind: "sign", sign: "Scorpio" },
  { kind: "sign", sign: "Sagittarius" },
  { kind: "sign", sign: "Capricorn" },
  { kind: "planet", planet: "Mars", element: "fire" },
  { kind: "sign", sign: "Aquarius" },
  { kind: "sign", sign: "Pisces" },
  { kind: "planet", planet: "Sun", element: "fire" },
  { kind: "element", element: "fire", planet: "Pluto", day: "Sun", note: "the element of fire, ruled in modern tarot by Pluto, the planet of rebirth" },
  { kind: "planet", planet: "Saturn", element: "earth" },
].map((a) => {
  if (a.kind !== "sign") return a;
  const s = sign(a.sign);
  return { ...a, element: s.element, planet: s.ruler, day: s.ruler };
});
CARD_ASTRO.forEach((a) => { a.day ||= a.planet; a.weekday = WEEKDAY[a.day]; });

export function astroLine(index) {
  const a = CARD_ASTRO[index];
  if (a.kind === "sign") { const s = sign(a.sign); return `In the tradition of the Golden Dawn, this card belongs to ${s.name} (${s.hindi}), ${s.element === "air" || s.element === "earth" ? "an" : "a"} ${s.element} sign ruled by ${s.ruler}.`; }
  if (a.kind === "planet") return `In the tradition of the Golden Dawn, this card belongs to ${a.planet === "Sun" || a.planet === "Moon" ? "the " + a.planet : "the planet " + a.planet}.`;
  return `In the tradition of the Golden Dawn, this card belongs to ${a.note}.`;
}

/* ---------- dates ---------- */

// Today's date in India, as a UTC-midnight Date.
export function todayIST(now = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now).split("-").map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2]));
}
const addDays = (d, n) => new Date(d.getTime() + n * DAY);
export const fmt = (d) => d.toLocaleDateString("en-IN", { day: "numeric", month: "long", timeZone: "UTC" });
const fmtMonth = (d) => d.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
export function parseDob(dob) { const [y, m, d] = dob.split("-").map(Number); return { y, m, d, date: new Date(Date.UTC(y, m - 1, d)) }; }

export function sunSign(m, d) {
  let found = sign("Capricorn");
  for (const s of SIGNS) {
    const [sm, sd] = s.start, next = SIGNS[(s.i + 1) % 12].start;
    const after = m > sm || (m === sm && d >= sd), before = m < next[0] || (m === next[0] && d < next[1]);
    if (s.name === "Capricorn" ? after || before : after && before) found = s;
  }
  return found;
}

// The next span (or the current one) when the Sun is in a sign.
function signSeason(name, today) {
  const s = sign(name), nx = SIGNS[(s.i + 1) % 12].start;
  for (const y of [today.getUTCFullYear() - 1, today.getUTCFullYear(), today.getUTCFullYear() + 1]) {
    const start = new Date(Date.UTC(y, s.start[0] - 1, s.start[1]));
    const endY = nx[0] < s.start[0] ? y + 1 : y;
    const end = addDays(new Date(Date.UTC(endY, nx[0] - 1, nx[1])), -1);
    if (end >= today) return { start, end, now: start <= today };
  }
  return null;
}

// Moon phases from a known new moon (6 Jan 2000, 18:14 UTC) and the mean synodic month. Accurate to about a day.
const SYNODIC = 29.530588853, NEW0 = Date.UTC(2000, 0, 6, 18, 14);
function nextPhase(today, phase /* 0 new, 0.5 full */, skip = 0) {
  const ist = today.getTime() + 5.5 * 3600000;
  let k = Math.ceil((ist - NEW0) / (SYNODIC * DAY) - phase);
  let t = NEW0 + (k + phase) * SYNODIC * DAY;
  if (t < ist) t += SYNODIC * DAY;
  t += skip * SYNODIC * DAY;
  return todayIST(new Date(t));
}
export const nextFullMoon = (today, skip = 0) => nextPhase(today, 0.5, skip);
export const nextNewMoon = (today, skip = 0) => nextPhase(today, 0, skip);

// When the card says it will happen: a concrete window, delayed if the card is reversed.
export function timing(index, today, reversed, birthday) {
  let start = today;
  const text = timingText(index, today, reversed, birthday, (d) => { start = d; });
  return { text, start };
}
function timingText(index, today, reversed, birthday, setStart) {
  const a = CARD_ASTRO[index];
  const range = (from, to) => { setStart(addDays(today, from)); return `between ${fmt(addDays(today, from))} and ${fmt(addDays(today, to))}`; };
  if (a.kind === "sign") {
    let w = signSeason(a.sign, today);
    if (reversed && w.now) w = signSeason(a.sign, addDays(w.end, 1));
    const s = sign(a.sign), yr = today.getUTCFullYear();
    const fy = (d) => fmt(d) + (d.getUTCFullYear() !== yr ? ` ${d.getUTCFullYear()}` : "");
    const span = `${fy(w.start)} to ${fy(w.end)}`; setStart(w.now ? today : w.start);
    if (w.now) return `${s.name} season, which is running now until ${fy(w.end)}. This is the window: what you have asked about moves before ${fy(w.end)}, or it waits for this season to come round again.`;
    return `${s.name} season, ${span}${reversed ? ", and since the card is reversed, expect it later in that window rather than early" : ""}. Watch that window; that is when this card's energy is strongest and things move.`;
  }
  switch (a.planet) {
    case "Moon": { const fm = nextFullMoon(today, reversed ? 1 : 0); setStart(fm); return `the Moon's rhythm, so by the full moon of ${fmt(fm)}${reversed ? ", one cycle later than you would hope, because the card is reversed" : ""}. Things hidden come to light around a full moon.`; }
    case "Mercury": return `Mercury's pace, which is quick, so ${reversed ? range(21, 42) + ", after a delay or a miscommunication is cleared up" : range(7, 21)}.`;
    case "Venus": return `Venus's pace, gentle and steady, so ${reversed ? range(45, 90) : range(14, 45)}, with Fridays the most favourable days.`;
    case "Mars": return `Mars's pace, sudden and fast, so ${reversed ? range(14, 35) + ", after a clash or a false start" : range(3, 14)}.`;
    case "Jupiter": { const from = addDays(today, reversed ? 120 : 60), to = addDays(today, reversed ? 240 : 150); setStart(from); return `Jupiter's pace, a turning of the wheel over months, so between ${fmtMonth(from)} and ${fmtMonth(to)}.`; }
    case "Saturn": { const from = addDays(today, reversed ? 240 : 150), to = addDays(today, reversed ? 420 : 300); setStart(from); return `Saturn's pace, slow but final, so between ${fmtMonth(from)} and ${fmtMonth(to)}. What Saturn gives, it gives for good.`; }
    case "Sun": {
      if (birthday && !reversed) { const days = Math.round((birthday - today) / DAY); if (days > 0 && days <= 120) { setStart(birthday); return `the Sun's own day for you, around your birthday on ${fmt(birthday)}. The Sun card peaks when the Sun returns to where it stood when you were born.`; } }
      return `the Sun's pace, clear and bright, so ${reversed ? range(30, 75) + ", once a cloud passes" : range(10, 40)}.`;
    }
    case "Uranus": return `the pace of air and surprise, so ${reversed ? range(20, 50) + ", once you stop hesitating" : "within days, " + range(2, 12)}. It may come without warning.`;
    case "Neptune": { const nm = nextNewMoon(today), fm = nextFullMoon(nm, reversed ? 1 : 0); setStart(nm); return `water's pace, which needs a pause first. Nothing moves before the new moon of ${fmt(nm)}, and things settle by the full moon of ${fmt(fm)}.`; }
    case "Pluto": { const from = addDays(today, reversed ? 75 : 30), to = addDays(today, reversed ? 150 : 90); setStart(from); return `fire's pace, after a chapter closes, so ${`between ${fmt(from)} and ${fmt(to)}`}.`; }
    default: return "soon";
  }
}

/* ---------- elemental dignities ---------- */

const PAIR = { fire: { air: "friendly", water: "contrary", earth: "neutral" }, air: { fire: "friendly", earth: "contrary", water: "neutral" }, water: { earth: "friendly", fire: "contrary", air: "neutral" }, earth: { water: "friendly", air: "contrary", fire: "neutral" } };
const GROW = {
  fire: { water: "to feel before you act", air: "", earth: "" },
  air: { earth: "to stop analysing and do one practical thing", fire: "", water: "" },
  water: { fire: "to act boldly instead of waiting to feel sure", earth: "", air: "" },
  earth: { air: "to talk it through and stay open to a new idea", water: "", fire: "" },
};
export function dignity(userEl, cardEl) {
  if (userEl === cardEl) return { kind: "same", text: `It speaks in your own element, ${cardEl}, so its message lands with full force for you. Trust it.` };
  const k = PAIR[userEl][cardEl];
  if (k === "friendly") return { kind: "friendly", text: `${cap(cardEl)} is a friendly element to your ${userEl}, so this card is on your side. It supports you rather than tests you.` };
  if (k === "contrary") return { kind: "contrary", text: `${cap(cardEl)} opposes your ${userEl}, so this card asks for what does not come naturally to you: ${GROW[userEl][cardEl]}. That is exactly where the answer lies.` };
  return { kind: "neutral", text: `${cap(cardEl)} and ${userEl} are neutral to each other, so the outcome rests on your choices more than on luck.` };
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- numerology ---------- */

const digits = (n) => String(n).split("").reduce((a, c) => a + Number(c), 0);
export function reduce(n, keepMasters = false) { while (n > 9 && !(keepMasters && (n === 11 || n === 22 || n === 33))) n = digits(n); return n; }

export const lifePath = ({ y, m, d }) => reduce(reduce(d, true) + reduce(m, true) + reduce(y, true), true);
export const personalYear = ({ m, d }, year) => reduce(reduce(d) + reduce(m) + reduce(year));
export const personalMonth = (py, month) => reduce(py + month);

export const YEAR_THEME = {
  1: "the start of a new nine-year cycle: beginnings, and doing things your own way",
  2: "patience, partnership, and waiting for things to ripen",
  3: "expression, friendships and being seen",
  4: "hard work and laying foundations",
  5: "change, movement and freedom",
  6: "home, love, family and responsibility",
  7: "reflection, study and inner truth",
  8: "money, power and career results",
  9: "the end of a nine-year cycle: release and completion",
};
export const LIFE_PATH = {
  1: "the leader and pioneer", 2: "the peacemaker and partner", 3: "the communicator and creator", 4: "the builder",
  5: "the free spirit and traveller", 6: "the nurturer and protector", 7: "the seeker of truth", 8: "the achiever, at home with power and money",
  9: "the old soul and humanitarian", 11: "the intuitive, a master number", 22: "the master builder, a master number", 33: "the master teacher, a master number",
};

// Mary K. Greer's birth cards: add month, day and year, then reduce to the Major Arcana.
export function birthCards({ y, m, d }) {
  let s = digits(m + d + y);
  if (s === 22) return [0, 4];
  while (s > 21) s = digits(s);
  const out = [s];
  while (s >= 10) { s = digits(s); out.push(s); }
  return out;
}

/* ---------- the querent's chart ---------- */

export function chart(profile, today = todayIST()) {
  if (!profile?.dob) return null;
  const b = parseDob(profile.dob);
  const sun = sunSign(b.m, b.d);
  const py = personalYear(b, today.getUTCFullYear());
  let birthday = new Date(Date.UTC(today.getUTCFullYear(), b.m - 1, b.d));
  if (birthday < today) birthday = new Date(Date.UTC(today.getUTCFullYear() + 1, b.m - 1, b.d));
  const age = today.getUTCFullYear() - b.y - (new Date(Date.UTC(today.getUTCFullYear(), b.m - 1, b.d)) > today ? 1 : 0);
  return {
    sun, lifePath: lifePath(b), personalYear: py, personalMonth: personalMonth(py, today.getUTCMonth() + 1),
    birthCards: birthCards(b), birthday, age, year: today.getUTCFullYear(), month: today.toLocaleDateString("en-IN", { month: "long", timeZone: "UTC" }),
  };
}

// The last day of the timeframe the question names ("this month", "in 3 weeks"...), or null.
export function deadline(tf, today) {
  if (!tf) return null;
  const y = today.getUTCFullYear(), m = today.getUTCMonth();
  if (tf === "today" || tf === "tonight") return today;
  if (tf === "tomorrow") return addDays(today, 1);
  if (tf === "this week") return addDays(today, 7);
  if (tf === "next week") return addDays(today, 14);
  if (tf === "this month") return new Date(Date.UTC(y, m + 1, 0));
  if (tf === "next month") return new Date(Date.UTC(y, m + 2, 0));
  if (tf === "this year") return new Date(Date.UTC(y, 11, 31));
  if (tf === "next year") return new Date(Date.UTC(y + 1, 11, 31));
  if (tf === "soon") return addDays(today, 45);
  const n = tf.match(/^in (a|\d+) (day|week|month|year)s?$/);
  if (n) { const k = n[1] === "a" ? 1 : +n[1]; return addDays(today, k * { day: 1, week: 7, month: 30, year: 365 }[n[2]]); }
  return null;
}
