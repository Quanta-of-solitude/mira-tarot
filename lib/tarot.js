// Shared by server and client: the deck, packs and the fixed fallback reading.

export const FREE_CREDITS = 3;

// amount is in paise (Razorpay's unit). 14900 = ₹149.
export const PACKS = {
  five: { id: "five", credits: 5, amount: 14900, label: "5 questions" },
  fifteen: { id: "fifteen", credits: 15, amount: 39900, label: "15 questions" },
};

export const DECK = [
  ["0", "The Fool", "cliff", "Beginnings · Faith · Freedom", "Something new wants to begin. Curiosity will take you further than certainty right now.", "Either you are rushing ahead without looking, or fear is keeping you at the edge. Find the step between.", "Take one small, real step this week."],
  ["I", "The Magician", "infinity", "Will · Skill · Focus", "You already hold the tools you need. Focus and intention will turn this idea into a result.", "Scattered energy, or someone's clever words, may be misleading you. Check what is real.", "Name one goal and act on it today."],
  ["II", "The High Priestess", "moon", "Intuition · Mystery · Stillness", "The answer is quieter than you think. Your intuition has noticed something your mind hasn't caught up to.", "You may be drowning out your inner voice with other people's opinions.", "Give yourself silence before you decide."],
  ["III", "The Empress", "venus", "Abundance · Care · Growth", "Growth, comfort and abundance are close. What you nurture now will flourish.", "You may be giving to everyone except yourself.", "Look after your own needs first, then share."],
  ["IV", "The Emperor", "crown", "Structure · Authority · Stability", "Structure and clear boundaries will serve you. Take charge calmly.", "Rigidity, or someone else's control, is limiting you.", "Make a plan and hold one firm boundary."],
  ["V", "The Hierophant", "key", "Tradition · Guidance · Wisdom", "A mentor, a tradition or a proven path holds the guidance you need.", "Old rules may no longer fit you. You are allowed to question them.", "Ask someone who has walked this road before you."],
  ["VI", "The Lovers", "heart", "Union · Choice · Alignment", "A meaningful bond or an important choice of the heart is before you. Alignment matters more than ease.", "Something is out of balance between what you want and what you are choosing.", "Choose what matches your values, not your fears."],
  ["VII", "The Chariot", "triangle", "Willpower · Victory · Drive", "Momentum is on your side. Determination will carry you past the obstacles.", "You are being pulled in two directions. Steady the reins before you move.", "Commit to one direction and keep going."],
  ["VIII", "Strength", "flame", "Courage · Patience · Heart", "Gentle courage wins here. Patience and compassion are your real power.", "Self-doubt is speaking louder than it deserves to.", "Respond softly, but don't back down."],
  ["IX", "The Hermit", "lantern", "Solitude · Insight · Search", "Step back and look inward. Time alone will bring the clarity you're searching for.", "Too much withdrawal is turning into loneliness. Let someone in.", "Sit alone with this question for an hour, then trust what surfaces."],
  ["X", "Wheel of Fortune", "wheel", "Change · Cycles · Luck", "The tide is turning. A change in luck or circumstance is already in motion.", "This is a temporary setback, not a permanent one. The wheel always moves.", "Stay flexible and ride the change instead of fighting it."],
  ["XI", "Justice", "scales", "Truth · Fairness · Balance", "Truth and fairness will prevail. Decisions made honestly now will hold.", "Something feels unfair, or accountability is being avoided.", "Be honest, especially with yourself."],
  ["XII", "The Hanged Man", "triangleDown", "Pause · Surrender · Perspective", "A pause is not a failure. Seeing this from a new angle unlocks the way forward.", "Waiting has turned into stalling. It is time to let go and move.", "Look at the situation from the other person's side."],
  ["XIII", "Death", "hourglass", "Endings · Renewal · Change", "Something is ending so something better can begin. This is transformation, not loss.", "Holding on to what is already finished is keeping you stuck.", "Release one thing you have outgrown."],
  ["XIV", "Temperance", "cup", "Balance · Patience · Healing", "Balance and patience will bring the outcome you want. Blend, don't force.", "Extremes are pulling you off centre.", "Find the middle way and take it slowly."],
  ["XV", "The Devil", "chain", "Attachment · Habit · Shadow", "Look at what binds you: a habit, a fear, a pattern. The chain is looser than it looks.", "You are ready to break free from something that has held you.", "Name the pattern out loud. Naming it loosens it."],
  ["XVI", "The Tower", "tower", "Upheaval · Truth · Release", "A sudden shake-up clears away what was built on weak ground. What remains will be true.", "You may be resisting a change that has to happen.", "Let what is falling fall, and rebuild on firm ground."],
  ["XVII", "The Star", "star", "Hope · Healing · Renewal", "Hope returns. Healing and quiet optimism light the way ahead.", "Your faith in yourself has dimmed, but it hasn't gone out.", "Keep one small promise to yourself every day."],
  ["XVIII", "The Moon", "moonFull", "Illusion · Dreams · Instinct", "Not everything is as it seems. Move carefully and trust your instincts through the fog.", "The confusion is lifting and the truth is coming to light.", "Wait for clarity before making a big decision."],
  ["XIX", "The Sun", "sun", "Joy · Success · Warmth", "Joy, success and warmth. This is one of the brightest answers the deck can give.", "Happiness is close, though something small may delay it.", "Celebrate a win, however small."],
  ["XX", "Judgement", "eye", "Awakening · Calling · Rebirth", "A calling, or a moment of reckoning. You are ready to rise into a new version of yourself.", "Self-criticism is holding back your next chapter.", "Forgive the past and answer the call."],
  ["XXI", "The World", "wreath", "Completion · Wholeness · Travel", "Completion and fulfilment. A cycle closes in success and a new one opens.", "You are close to the finish. Don't leave this one undone.", "Finish what you started, then celebrate."],
].map(([num, name, emb, kw, up, rev, adv], index) => ({ index, num, name, emb, kw, up, rev, adv }));

function topicOf(q) {
  q = q.toLowerCase();
  if (/love|relationship|partner|crush|marri|boyfriend|girlfriend|husband|wife|\bex\b|dating|heart/.test(q)) return "love";
  if (/job|career|work|boss|interview|business|promotion|office|study|exam|college/.test(q)) return "career";
  if (/money|financ|invest|debt|loan|salary|income|rich|wealth|property/.test(q)) return "money";
  return "general";
}
const FRAME = { love: "In matters of the heart, ", career: "For your work and ambitions, ", money: "Where money is concerned, ", general: "For what you have asked, " };

// Short fixed reading, used only if composing the full reading fails.
export function fallbackReading(card, reversed, question) {
  return `${FRAME[topicOf(question)]}${card.name} ${reversed ? "appears reversed" : "appears upright"}. ${reversed ? card.rev : card.up}\n\nMy guidance: ${card.adv}`;
}

export function drawThree() {
  const idx = DECK.map((c) => c.index);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx.slice(0, 3).map((index) => ({ index, reversed: Math.random() < 0.25 }));
}

export function emblemSVG(t, color) {
  const star = (cx, cy, R, r, n) => { const p = []; for (let i = 0; i < n * 2; i++) { const a = (Math.PI * i) / n - Math.PI / 2, rr = i % 2 ? r : R; p.push((cx + rr * Math.cos(a)).toFixed(1) + "," + (cy + rr * Math.sin(a)).toFixed(1)); } return `<polygon points="${p.join(" ")}"/>`; };
  const rays = (n, r1, r2) => { let o = ""; for (let i = 0; i < n; i++) { const a = (2 * Math.PI * i) / n; o += `<line x1="${(50 + r1 * Math.cos(a)).toFixed(1)}" y1="${(50 + r1 * Math.sin(a)).toFixed(1)}" x2="${(50 + r2 * Math.cos(a)).toFixed(1)}" y2="${(50 + r2 * Math.sin(a)).toFixed(1)}"/>`; } return o; };
  const m = {
    cliff: `<path d="M10 80H48L56 60H90"/><circle cx="72" cy="32" r="9"/><path d="M30 80V66M40 80V70"/>`,
    infinity: `<path d="M28 50C28 34 44 34 50 50C56 66 72 66 72 50C72 34 56 34 50 50C44 66 28 66 28 50Z"/><line x1="50" y1="16" x2="50" y2="26"/><line x1="50" y1="74" x2="50" y2="84"/>`,
    moon: `<path d="M60 22A29 29 0 1 0 60 78A23 23 0 1 1 60 22Z" fill="currentColor" fill-opacity=".14"/>`,
    moonFull: `<circle cx="50" cy="48" r="24" fill="currentColor" fill-opacity=".1"/><path d="M58 30A18 18 0 1 0 58 66A14 14 0 1 1 58 30Z" fill="currentColor" fill-opacity=".35"/><path d="M22 82Q36 74 50 82T78 82"/>`,
    venus: `<circle cx="50" cy="40" r="17"/><line x1="50" y1="57" x2="50" y2="84"/><line x1="39" y1="72" x2="61" y2="72"/>`,
    crown: `<polygon points="20,70 24,34 38,54 50,26 62,54 76,34 80,70"/><line x1="20" y1="78" x2="80" y2="78"/>`,
    key: `<circle cx="32" cy="50" r="12"/><line x1="44" y1="50" x2="84" y2="50"/><line x1="74" y1="50" x2="74" y2="61"/><line x1="82" y1="50" x2="82" y2="58"/>`,
    heart: `<path d="M50 80C20 60 16 34 33 27C43 23 50 31 50 38C50 31 57 23 67 27C84 34 80 60 50 80Z" fill="currentColor" fill-opacity=".14"/>`,
    triangle: `<polygon points="50,20 82,78 18,78"/><circle cx="50" cy="60" r="7"/>`,
    flame: `<path d="M50 18C62 36 73 47 69 64C66 76 57 82 50 82C43 82 34 76 31 64C28 50 41 44 44 31C48 44 55 45 50 18Z" fill="currentColor" fill-opacity=".14"/>`,
    lantern: `<rect x="35" y="32" width="30" height="42" rx="4"/><line x1="50" y1="18" x2="50" y2="32"/><line x1="30" y1="80" x2="70" y2="80"/>${star(50, 53, 9, 3.5, 4)}`,
    wheel: `<circle cx="50" cy="50" r="30"/><circle cx="50" cy="50" r="8"/>${rays(8, 8, 30)}`,
    scales: `<line x1="50" y1="18" x2="50" y2="80"/><line x1="24" y1="30" x2="76" y2="30"/><path d="M14 54Q24 64 34 54Z M24 30L14 54M24 30L34 54"/><path d="M66 54Q76 64 86 54Z M76 30L66 54M76 30L86 54"/><line x1="38" y1="80" x2="62" y2="80"/>`,
    triangleDown: `<polygon points="20,24 80,24 50,78"/><circle cx="50" cy="40" r="6"/>`,
    hourglass: `<path d="M30 20H70M30 80H70M34 20L66 80M66 20L34 80"/><path d="M42 72L50 60L58 72Z" fill="currentColor"/>`,
    cup: `<path d="M30 28H70C70 52 60 62 50 62C40 62 30 52 30 28Z"/><line x1="50" y1="62" x2="50" y2="76"/><line x1="36" y1="78" x2="64" y2="78"/>`,
    chain: `<circle cx="39" cy="50" r="15"/><circle cx="61" cy="50" r="15"/><path d="M30 20L50 30L70 20"/>`,
    tower: `<rect x="38" y="36" width="24" height="44"/><polygon points="35,36 50,20 65,36"/><polyline points="76,14 62,38 71,38 58,60"/><rect x="46" y="62" width="8" height="18"/>`,
    star: `${star(50, 50, 32, 13, 8)}${star(50, 50, 9, 4, 4)}`,
    sun: `<circle cx="50" cy="50" r="15" fill="currentColor" fill-opacity=".14"/>${rays(12, 21, 33)}`,
    eye: `<path d="M16 50Q50 20 84 50Q50 80 16 50Z"/><circle cx="50" cy="50" r="11"/><circle cx="50" cy="50" r="4" fill="currentColor"/>`,
    wreath: `<ellipse cx="50" cy="50" rx="22" ry="32"/>${star(18, 18, 6, 2.5, 4)}${star(82, 18, 6, 2.5, 4)}${star(18, 82, 6, 2.5, 4)}${star(82, 82, 6, 2.5, 4)}`,
    back: `<circle cx="50" cy="50" r="40" stroke-width="1.4"/>${star(50, 50, 30, 11, 8)}<circle cx="50" cy="50" r="6"/>`,
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 100 100" fill="none" stroke="${color}" color="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${m[t] || m.star}</svg>`;
}
