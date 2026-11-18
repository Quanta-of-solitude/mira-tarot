// The details Mira reads with: birth date (for sun sign, numerology and birth cards),
// where you were born and live, your work and your relationship status. Shared by client and server.

export const RELATIONSHIP = [
  ["single", "Single"],
  ["dating", "Seeing someone"],
  ["relationship", "In a relationship"],
  ["engaged", "Engaged"],
  ["married", "Married"],
  ["separated", "Separated or divorced"],
  ["complicated", "It's complicated"],
  ["private", "Prefer not to say"],
];

const clean = (v, max = 60) => String(v || "").replace(/[<>{}\n\r\t]/g, "").replace(/\s+/g, " ").trim().slice(0, max);

// Returns { profile } or { error }.
export function validateProfile(body, now = new Date()) {
  const dob = String(body.dob || "");
  const m = dob.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return { error: "Please enter your date of birth." };
  const y = +m[1], mo = +m[2], d = +m[3];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return { error: "That date of birth doesn't look right." };
  if (y < 1920 || dt > now) return { error: "That date of birth doesn't look right." };
  const age = now.getUTCFullYear() - y - (now.getUTCMonth() < mo - 1 || (now.getUTCMonth() === mo - 1 && now.getUTCDate() < d) ? 1 : 0);
  if (age < 18) return { error: "Mira's readings are for people aged 18 and over." };
  const relationship = RELATIONSHIP.some(([k]) => k === body.relationship) ? body.relationship : "private";
  return {
    profile: { dob, birthPlace: clean(body.birthPlace), city: clean(body.city), work: clean(body.work), relationship },
  };
}

export const hasProfile = (p) => !!(p && p.dob);
