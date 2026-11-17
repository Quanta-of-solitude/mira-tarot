// Mira's readings, composed from the card and the question. No AI involved.
// The same reading id always produces the same reading (seeded choices).
import { DECK } from "./tarot";
import { CARDS } from "./oracle-cards";

/* ---------- reading the question ---------- */

const TOPICS = [
  ["love", /\b(love|lover|relationship|partner|crush|marri\w*|wedding|boyfriend|girlfriend|husband|wife|fianc\w*|ex|dating|date|soulmate|break ?up|propos\w*|romance|romantic|feelings for|likes? me|loves? me|text me|come back to me)\b/i],
  ["study", /\b(exams?|stud(y|ies|ying)|college|university|results?|admission|course|degree|neet|jee|upsc|cat|gate|boards?|marks|semester|school|scholarship)\b/i],
  ["work", /\b(job|jobs|career|work|boss|interview|business|promotion|office|startup|client|appraisal|hike|resign|quit|manager|company|offer letter|freelanc\w*|project)\b/i],
  ["money", /\b(money|financ\w*|invest\w*|debt|loan|salary|income|wealth|property|savings?|rich|stocks?|shares|crypto|rent|emi|lottery)\b/i],
  ["travel", /\b(travel|move|moving|abroad|relocat\w*|visa|shift(ing)?|city|country|trip|settle|migrat\w*|onsite)\b/i],
  ["people", /\b(family|mother|father|mom|mum|dad|parents?|brother|sister|sibling|friends?|son|daughter|in-?laws?|colleagues?|people|relatives?|grandm\w*|grandf\w*|forgiv\w*|apologi[sz]e|sorry|fight|fought|argument|trust me|betray\w*|upset|angry|talk to me|speak to me|miss me|reconcil\w*)\b/i],
  ["self", /\b(lost|stuck|recover\w*|surgery|illness|health|anxious|anxiety|stress\w*|happy|happiness|peace|purpose|myself|confiden\w*|lonely|sad|depress\w*|heal\w*|weight|sleep|fear|future|life|spiritual\w*|calling|direction)\b/i],
];
const AREA = { love: "love", study: "work", work: "work", money: "money", travel: "self", people: "people", self: "self" };
const FOCUS = {
  love: ["matters of the heart", "love", "this connection"],
  study: ["your studies", "your exams and studies"],
  work: ["your work", "your path at work", "your career"],
  money: ["money", "your finances"],
  travel: ["a move or a journey", "the road ahead of you"],
  people: ["the people close to you", "your family and friends"],
  self: ["yourself", "your own heart", "where your life is heading"],
  general: ["what lies ahead", "the thing weighing on you"],
};
const AFTER = new Set(["life", "partner", "friend", "path", "plans", "results", "result", "exam", "exams", "interview", "boyfriend", "girlfriend", "business", "career", "family", "future", "studies", "health", "marriage", "relationship"]);
const NOT_NAMES = new Set(["I", "Is", "Will", "Would", "Should", "Can", "Could", "Does", "Do", "Did", "Am", "Are", "What", "When", "Where", "Why", "How", "Who", "Which", "The", "My", "Mira", "God", "India", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December", "Diwali", "Holi",
  // places, so they aren't mistaken for people
  "Bangalore", "Bengaluru", "Pune", "Mumbai", "Bombay", "Delhi", "Noida", "Gurgaon", "Gurugram", "Chennai", "Hyderabad", "Kolkata", "Ahmedabad", "Jaipur", "Lucknow", "Kochi", "Goa", "Indore", "Chandigarh", "Bhopal", "Surat", "Nagpur", "Patna", "Dubai", "Singapore", "London", "Canada", "America", "USA", "Australia", "Germany", "Europe", "Japan", "Paris", "Toronto", "Sydney", "Melbourne"]);
const PLACE_WORDS = new Set(["in", "to", "from", "at", "near", "into", "towards", "toward", "of", "for", "across"]);
const SELF_HARM = /\b(suicid\w*|kill myself|end my life|end it all|self[- ]?harm|hurt myself|don'?t want to (live|be alive)|want to die|no reason to live)\b/i;
const HEALTH = /\b(health|ill|illness|disease|cancer|tumou?r|pregnan\w*|baby|surgery|operation|hospital|diagnos\w*|recover\w*|treatment|medicine|death|die|dying)\b/i;
const LEGAL = /\b(court|case|lawsuit|legal|lawyer|police|fir|divorce|custody|bail|hearing|verdict)\b/i;

export function readQuestion(raw) {
  const q = String(raw || "").trim();
  const lower = q.toLowerCase();
  const topic = (TOPICS.find(([, re]) => re.test(q)) || ["general"])[0];
  let type = "open";
  if (/^(when|how (long|soon))\b/i.test(lower) || /\bwhen will\b/.test(lower)) type = "when";
  else if (/^should\b|\bshould i\b/.test(lower)) type = "should";
  else if (/^(will|is|are|does|do|can|could|would|am|has|have|did|was|were|shall)\b/.test(lower)) type = "yesno";
  else if (/^why\b/.test(lower)) type = "why";
  const choice = /\b\w+ or \w+/.test(lower) && (type === "should" || /^which\b/.test(lower));

  let subject = null;
  const m = lower.match(/\bmy ([a-z'-]+)(?: ([a-z'-]+))?/);
  if (m && !["own", "life", "self", "mind"].includes(m[1])) subject = "your " + m[1] + (m[2] && AFTER.has(m[2]) ? " " + m[2] : "");
  else if (m && m[1] === "life") subject = "your life";

  // A capitalised word after the first, not a known place and not right after "in", "to", "from"...
  let person = null;
  const words = q.split(/\s+/);
  for (let i = 1; i < words.length; i++) {
    const word = words[i].replace(/[^A-Za-z]/g, ""), prev = words[i - 1].toLowerCase().replace(/[^a-z]/g, "");
    if (/^[A-Z][a-z]{2,}$/.test(word) && !NOT_NAMES.has(word) && !PLACE_WORDS.has(prev)) { person = word; break; }
  }
  // A question about a named person with no other clue is about that relationship.
  const topicFinal = topic === "general" && person ? "people" : topic;

  const tf = lower.match(/\b(today|tonight|tomorrow|this week|next week|this month|next month|this year|next year|in (a|\d+) (days?|weeks?|months?|years?)|soon|ever)\b/);
  return {
    q, topic: topicFinal, area: AREA[topicFinal] || null, type, choice, subject, person, timeframe: tf ? tf[0] : null,
    selfHarm: SELF_HARM.test(q), health: HEALTH.test(q), legal: LEGAL.test(q),
  };
}

/* ---------- seeded choice ---------- */

function rng(seedText) {
  let h = 1779033703 ^ seedText.length;
  for (let i = 0; i < seedText.length; i++) { h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const firstKw = (c) => c.kw.split("·")[0].trim().toLowerCase();

/* ---------- Mira's phrases ---------- */

const OPEN = [
  "{nameC}you came to my table asking about {focus}, and the card that rose to answer is {card}.",
  "For a question about {focus}, the deck chose {card}.",
  "{card}. Of every card that could have come for {focus}, this is the one that did.",
  "I turned the card for your question about {focus}{nameT}. It is {card}.",
  "{nameC}the deck has spoken about {focus}, and it speaks through {card}.",
];
const SEE = ["Look at it with me: {img}.", "On its face, {img}.", "I see {img}.", "Notice the image: {img}."];
const REVERSED = [
  "It came to you reversed, so its energy is blocked, delayed or turned inward.",
  "It lies upside down, which tells me this energy is struggling to move freely right now.",
  "Reversed, it speaks of something held back, or a lesson not yet learned.",
];
const UPRIGHT = ["It came upright, so its message is direct.", "It lies upright; its meaning flows freely.", ""];
const PERSON = ["As for {person}, read this card as much about them as about you.", "{person} is part of this picture; watch how they respond to the energy of this card."];

const LEAN = {
  yes: ["If you want it plainly: yes. This card leans toward it.", "The answer leans toward yes.", "Yes is close, and this card does not hesitate."],
  likely: ["It leans toward yes, but it asks something of you first.", "Likely, yes, though not without effort on your part."],
  unclear: ["The answer is not fixed yet; it depends on what you do next.", "This card will not give a plain yes or no. Something still has to be decided, or revealed."],
  notyet: ["Not yet. The door is not closed, but this is not its moment.", "Not now, but the story is not finished."],
  no: ["Not in the way you are picturing it.", "The card leans toward no, at least as things stand."],
  change: ["Not in its current form. Something has to end before a true yes can arrive.", "Not as things are now. This card asks for a change first."],
};
const SHOULD = {
  yes: "So, should you? The card says yes. Go ahead.",
  likely: "So, should you? Yes, once you have prepared properly.",
  unclear: "So, should you? Not until you know more. Find out what is missing first.",
  notyet: "So, should you? Wait. Not because the answer is no, but because the timing is not ripe.",
  no: "So, should you? Not this way. Look for another route to what you want.",
  change: "So, should you? Only if you are willing to let something old go first.",
};
const CHOICE = {
  yes: "You named two paths. This card favours the one that moves you forward, even if it frightens you a little.",
  likely: "You named two paths. This card favours the one that asks for steady effort rather than luck.",
  unclear: "You named two paths. This card favours whichever keeps your options open while you learn more.",
  notyet: "You named two paths. This card favours the one that lets you wait without losing ground.",
  no: "You named two paths. This card warns against the one that tempts you most; look again at the steadier choice.",
  change: "You named two paths. This card favours the one that is truly new, rather than a repair of the old.",
};
const WINDOW = {
  yes: "That window looks open.", likely: "That window looks open, if you do your part.",
  unclear: "Whether that window opens depends on choices still being made.",
  notyet: "That may be too soon; give it longer.", no: "That may be too soon; give it longer.", change: "Something must close first, so it may take longer than that.",
};
const PASSED = [
  "To either side lay {a} and {b}, the paths you passed over. {A} speaks of {ka}, {B} of {kb}; both are near you, but tonight they are not your answer.",
  "The cards you did not choose, {a} and {b}, still matter. Hold {ka} and {kb} lightly: they are the weather around your question, not its answer.",
  "Your hand passed over {a} and {b}. Themes of {ka} and {kb} are drifting around this question, but the card you chose speaks louder.",
];
const REFLECT = ["Sit with this: {r}", "Ask yourself tonight: {r}", "Carry one question home with you: {r}"];

const HEALTH_NOTE = "Where your health is concerned, let a doctor guide the decisions. The card speaks only to how you carry this, not to what will happen in your body.";
const LEGAL_NOTE = "For the legal side of this, a lawyer is the right guide. The card speaks to how you hold yourself through it.";

function careReading(name) {
  return `${name ? name + ", " : ""}I am putting the cards down for a moment, because what you wrote matters more than any card.

If you are thinking about ending your life or hurting yourself, please talk to someone today. In India you can call Tele-MANAS, free and at any hour, on 14416 or 1-800-891-4416. If you are in immediate danger, call 112.

You do not have to carry this alone. Tell one person you trust how you are really feeling, tonight if you can.

My guidance: reach out to someone now. You deserve support, and it is there for you.`;
}

/* ---------- the reading ---------- */

// card: deck entry, reversed: bool, others: [{index, reversed}] for the two cards not chosen.
export function composeReading({ question, card, reversed, name, others = [], seed = "" }) {
  const Q = readQuestion(question);
  if (Q.selfHarm) return careReading(name);
  const R = rng(seed + "|" + question + "|" + card.index + (reversed ? "r" : "u"));
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  const C = CARDS[card.index], o = reversed ? "rev" : "up", lean = C.lean[o];
  const cardName = card.name;
  const aboutPerson = !Q.subject && Q.person && Q.topic === "people";
  const focus = Q.subject || (aboutPerson ? Q.person : pick(FOCUS[Q.topic] || FOCUS.general));
  const v = { card: cardName, focus, img: C.img, nameC: name && R() < 0.5 ? `${name}, ` : "", nameT: "" };
  if (name && !v.nameC && R() < 0.5) v.nameT = `, ${name}`;

  // 1. What she sees
  const p1 = [cap(fill(pick(OPEN), v)), fill(pick(SEE), v), reversed ? pick(REVERSED) : pick(UPRIGHT)].filter(Boolean);

  // 2. What it means for this question
  const p2 = [];
  if (Q.topic === "study") p2.push(pick(["Your studies are your work right now, so read this as the card of your effort.", "For your studies, think of this as the card of your daily effort."]));
  if (Q.topic === "travel") p2.push(pick(["On the question of moving or travelling, this card speaks about whether you are ready inside.", "For a journey or a move, this card looks at the traveller before the road."]));
  let meaning = Q.area ? C[o][Q.area] : (reversed ? card.rev : card.up);
  if (Q.topic === "study") meaning = meaning.replace(/\bin your work\b/g, "in your studies").replace(/\bat work\b/g, "in your studies").replace(/\byour work\b/g, "your studies");
  p2.push(meaning);
  if (Q.person) p2.push(aboutPerson ? `Read this card for ${Q.person} as much as for yourself.` : fill(pick(PERSON), { person: Q.person }));
  const verdictOff = Q.health || Q.legal; // never predict medical or legal outcomes
  if (verdictOff && (Q.type === "yesno" || Q.type === "should" || Q.type === "when")) {
    p2.push(Q.health
      ? "I will not put a yes or no on your body. What the card can show is the spirit you bring to it, and that spirit matters."
      : "I will not predict a verdict. What the card can show is how to carry yourself through it.");
  } else if (Q.choice) p2.push(CHOICE[lean]);
  else if (Q.type === "yesno") p2.push(pick(LEAN[lean]));
  else if (Q.type === "should") p2.push(SHOULD[lean]);
  else if (Q.type === "when") {
    p2.push(`As for when: ${C.time}.`);
    if (reversed) p2.push("Because it came reversed, expect some delay before that.");
  } else if (Q.type === "why") {
    p2.push(`The reason sits in the card's heart: ${firstKw(card)}. ${reversed ? "Something about it has been blocked or avoided." : "That is what this situation is teaching you."}`);
  }
  if (Q.timeframe && Q.type !== "when" && !verdictOff) p2.push(`You asked about ${Q.timeframe === "ever" ? "whether it will ever happen" : Q.timeframe}. ${WINDOW[lean]}`);
  if (Q.health) p2.push(HEALTH_NOTE);
  else if (Q.legal) p2.push(LEGAL_NOTE);

  // 3. The cards passed over, and something to sit with
  const p3 = [];
  const passed = others.filter((x) => x.index !== card.index);
  if (passed.length === 2) {
    const [a, b] = passed.map((x) => DECK[x.index]);
    p3.push(fill(pick(PASSED), { a: a.name, b: b.name, A: a.name, B: b.name, ka: firstKw(a), kb: firstKw(b) }));
  }
  p3.push(fill(pick(REFLECT), { r: C.reflect }));

  // 4. Guidance
  const advice = reversed ? C.advRev : card.adv;
  const g = `My guidance${name && R() < 0.4 ? `, ${name}` : ""}: ${advice}`;

  return [p1.join(" "), p2.join(" "), p3.join(" "), g].join("\n\n");
}
