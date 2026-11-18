// Mira's readings, composed from the card and the question. No AI involved.
// The same reading id always produces the same reading (seeded choices).
import { DECK } from "./tarot";
import { CARDS } from "./oracle-cards";
import { LORE } from "./card-lore";
import { CARD_ASTRO, astroLine, chart as makeChart, deadline, dignity, reduce, timing, todayIST, YEAR_THEME, LIFE_PATH } from "./astro";

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
  unclear: ["It depends on what you do next, and on one thing that has not been revealed yet.", "This card will not give a plain yes or no. Something still has to be decided, or revealed."],
  notyet: ["The door is not closed, but this is not its moment.", "The story is not finished; it simply is not time yet."],
  no: ["Not in the way you are picturing it.", "The card leans toward no, at least as things stand."],
  change: ["Something has to end before a true yes can arrive.", "As things are now, no. This card asks for a change first."],
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

/* ---------- personal context ---------- */

const VERDICT = { yes: "Yes", likely: "Leaning yes", unclear: "Not decided yet", notyet: "Not yet", no: "Leaning no", change: "Not in its current form" };
const group = (lean) => (lean === "yes" || lean === "likely" ? "pos" : lean === "unclear" ? "mid" : lean === "change" ? "chg" : "neg");

const STATUS = {
  single: {
    pos: "You are single, and this card says someone new is coming in, most likely through {where}.",
    mid: "You are single, and the card says the right person is not settled yet. Meet people through {where}, and keep your standards.",
    neg: "You are single, and the card says the person you are waiting on is not the answer right now. Widen your circle first, especially through {where}.",
  },
  dating: {
    pos: "You are seeing someone, and this card says it can become something real.",
    mid: "You are seeing someone, and it is still undecided: neither of you has shown your full hand yet.",
    neg: "You are seeing someone, and this card does not see it growing into what you want as things stand.",
  },
  relationship: {
    pos: "You are in a relationship, and this card strengthens it. The bond can deepen now.",
    mid: "You are in a relationship, and the bond is at a crossroads. It turns on one honest conversation.",
    neg: "You are in a relationship, and something in it has to change, or the same problem will keep repeating.",
  },
  engaged: {
    pos: "You are engaged, and this card blesses the road to marriage.",
    mid: "You are engaged; plans may need adjusting, but the bond holds if you both talk openly.",
    neg: "You are engaged, and the card shows delays or family friction around the plans. Face them together, not apart.",
  },
  married: {
    pos: "You are married, and this card brings warmth and renewal into the marriage.",
    mid: "You are married, and the marriage is asking for attention and one honest conversation.",
    neg: "You are married, and the marriage is under strain. A pattern between you has to change.",
  },
  separated: {
    pos: "You have been through a separation, and this card says love can come again, most likely through {where}.",
    mid: "You have been through a separation, and part of you is still healing. The next chapter is close, but not ready yet.",
    neg: "You have been through a separation, and looking back will not help. Close the old chapter fully before you open a new one.",
  },
  complicated: {
    pos: "You said it is complicated, and this card says it can be untangled in your favour.",
    mid: "You said it is complicated, and nothing will clear until someone is honest.",
    neg: "You said it is complicated, and the complication is itself the answer: it is not giving you what you need.",
  },
};

const STEP = {
  work: { pos: "Update your CV or portfolio and send at least two applications, pitches or requests inside the window below.", mid: "Before you decide, talk to one person who already has the role or result you want.", neg: "Do not resign or sign anything in a hurry. Build your skills and savings first, so that when the door opens you are ready.", chg: "Close the old chapter properly first: finish what you owe, leave on good terms, then make the move." },
  study: { pos: "Fix one study hour at the same time every day, and work through past papers.", mid: "Find exactly where you are weakest and fix that first; it decides the result more than your strengths.", neg: "Do not change course in a hurry. Strengthen the basics before you add anything new.", chg: "Drop the method that is not working and start fresh with a new routine from Monday." },
  money: { pos: "Put the extra into savings first, and make one planned investment rather than several impulsive ones.", mid: "Write down every rupee you spend for two weeks before you make any money decision.", neg: "Avoid new loans, lending and risky investments until the window below has passed.", chg: "Clear one old debt or cancel one draining expense before you start anything new." },
  love: { pos: "Make the first move: one honest message or one plan, without overthinking it.", mid: "Ask the direct question instead of reading signs; the answer will save you months.", neg: "Step back and give it space. Do not chase, and do not keep checking their messages.", chg: "Let the old version of this go. What comes next can only grow once you stop holding the door to the past." },
  people: { pos: "Reach out first, in person if you can.", mid: "Have the conversation, but listen more than you speak.", neg: "Protect your peace: set one clear boundary and keep it.", chg: "Let the old pattern between you end. Say what has changed, plainly and kindly." },
  travel: { pos: "Start the paperwork and research now; the timing supports it.", mid: "Speak to someone who already lives there before you commit.", neg: "Hold the move for now, and do not book anything you cannot cancel.", chg: "Wrap up what ties you here first; once that is done, the move becomes easy." },
  self: { pos: "Start the routine you keep postponing, tomorrow morning.", mid: "Write for ten minutes each night this week; the pattern will show itself.", neg: "Rest and reduce. Drop one obligation this week and protect your sleep.", chg: "Let one old habit or belief go this week, deliberately, and notice the space it leaves." },
  general: { pos: "Act on it this week, while the energy is with you.", mid: "Gather one more piece of information before you decide.", neg: "Hold back for now, and put your energy into preparing.", chg: "Let something old end first; the new thing needs the room." },
};

function destination(q) {
  const m = q.match(/\b(?:to|in|for)\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?)/);
  return m && !/^(I|My|The|Mira)$/.test(m[1]) ? m[1] : null;
}

/* ---------- the reading ---------- */

// card: deck entry, reversed: bool, others: [{index, reversed}] for the two cards not chosen.
// profile: { dob, birthPlace, city, work, relationship } or null. today: a UTC-midnight date (defaults to today in India).
export function composeReading({ question, card, reversed, name, others = [], seed = "", profile = null, today = todayIST() }) {
  const Q = readQuestion(question);
  if (Q.selfHarm) return careReading(name);
  const R = rng(seed + "|" + question + "|" + card.index + (reversed ? "r" : "u"));
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  const C = CARDS[card.index], L = LORE[card.index], A = CARD_ASTRO[card.index], o = reversed ? "rev" : "up", lean = C.lean[o], grp = group(lean);
  const ch = makeChart(profile, today);
  const cardName = card.name;
  const aboutPerson = !Q.subject && Q.person && Q.topic === "people";
  const focus = Q.subject || (aboutPerson ? Q.person : pick(FOCUS[Q.topic] || FOCUS.general));
  const v = { card: cardName, focus, img: C.img, nameC: name && R() < 0.5 ? `${name}, ` : "", nameT: "" };
  if (name && !v.nameC && R() < 0.5) v.nameT = `, ${name}`;
  const verdictOff = Q.health || Q.legal; // never predict medical or legal outcomes
  const out = [];

  // 1. The card, as she sees it
  out.push([cap(fill(pick(OPEN), v)), fill(pick(SEE), v), reversed ? pick(REVERSED) : pick(UPRIGHT), astroLine(card.index)].filter(Boolean).join(" "));

  // 2. The answer
  const p2 = [];
  const asksVerdict = Q.choice || Q.type === "yesno" || Q.type === "should";
  if (asksVerdict && !verdictOff) {
    p2.push(`Answer: ${VERDICT[lean]}.`);
    if (Q.choice) p2.push(CHOICE[lean]);
    else if (Q.type === "yesno") p2.push(pick(LEAN[lean]));
    else p2.push(SHOULD[lean]);
  }
  if (Q.topic === "study") p2.push(pick(["Your studies are your work right now, so read this as the card of your effort.", "For your studies, think of this as the card of your daily effort."]));
  let meaning = Q.area ? C[o][Q.area] : (reversed ? card.rev : card.up);
  if (Q.topic === "study") meaning = meaning.replace(/\bin your work\b/g, "in your studies").replace(/\bat work\b/g, "in your studies").replace(/\byour work\b/g, "your studies");
  p2.push(meaning);
  if (Q.topic === "love" && STATUS[profile?.relationship]) p2.push(fill(STATUS[profile.relationship][grp === "chg" ? "neg" : grp], { where: L.where }));
  if ((Q.topic === "work" || Q.topic === "money") && profile?.work) p2.push(`For you, working as ${/^[aeiou]/i.test(profile.work) ? "an" : "a"} ${profile.work}, that means: ${L.move[o]}.`);
  if (Q.topic === "travel") {
    const dest = destination(Q.q), from = profile?.city;
    if (dest || from) p2.push(`On a move${from ? ` from ${from}` : ""}${dest && dest !== from ? ` to ${dest}` : ""}, this card looks at whether you are ready inside before it looks at the road.`);
  }
  if (Q.person) p2.push(aboutPerson ? `Read this card for ${Q.person} as much as for yourself.` : fill(pick(PERSON), { person: Q.person }));
  if (verdictOff && (asksVerdict || Q.type === "when")) {
    p2.push(Q.health
      ? "I will not put a yes or no on your body. What the card can show is the spirit you bring to it, and that spirit matters."
      : "I will not predict a verdict. What the card can show is how to carry yourself through it.");
  } else if (Q.type === "why") p2.push(`The reason sits in the card's heart: ${firstKw(card)}. ${reversed ? "Something about it has been blocked or avoided." : "That is what this situation is teaching you."}`);
  if (Q.timeframe === "ever" && !verdictOff) p2.push(`You asked whether it will ever happen. ${WINDOW[lean]}`);
  if (Q.health) p2.push(HEALTH_NOTE);
  else if (Q.legal) p2.push(LEGAL_NOTE);
  out.push(p2.join(" "));

  // 3. Why: the card read against her chart
  if (ch) {
    const p3 = [`Why I read it this way: your sun sign is ${ch.sun.name} (${ch.sun.hindi}) by the Western zodiac that tarot uses, so your element is ${ch.sun.element}.`];
    p3.push(dignity(ch.sun.element, A.element).text);
    if (ch.birthCards.includes(card.index)) p3.push(`And this is one of your birth cards, worked out from your date of birth, so this reading touches something lifelong in you. Take it seriously.`);
    p3.push(`In numerology, ${ch.year} is a personal ${ch.personalYear} year for you: ${YEAR_THEME[ch.personalYear]}.`);
    const cn = reduce(card.index);
    if (card.index > 0 && cn === ch.personalYear) p3.push(`${cardName} carries the number ${cn}, the same as your year, which makes this message stronger.`);
    else if (R() < 0.5) p3.push(`Your life path is ${ch.lifePath}, ${LIFE_PATH[ch.lifePath]}, and that is the lens to read this card through.`);
    out.push(p3.join(" "));
  }

  // 4. When
  if (!Q.health) {
    const when = timing(card.index, today, reversed, ch?.birthday), end = deadline(Q.timeframe, today);
    let late = "";
    if (end && when.start > end) late = ` That is later than ${Q.timeframe === "soon" ? "soon" : Q.timeframe}, so within the time you asked about, expect the groundwork rather than the result.`;
    else if (end && Q.timeframe !== "ever") {
      const tf = Q.timeframe === "soon" ? "the time you asked about" : Q.timeframe;
      late = grp === "pos" ? ` That falls inside ${tf}.` : grp === "mid" ? ` That falls inside ${tf}, if you act on what this card asks.` : ` Something shifts inside ${tf}, but the result you want comes after that shift, not before it.`;
    }
    out.push(`When: ${cap(when.text)}${late}`);
  }

  // 5. What to do, and what to watch for
  const step = STEP[Q.topic] || STEP[Q.area] || STEP.general;
  const doThis = Q.health
    ? ["What to do: follow your doctor's plan closely, ask every question you have, and let the people who love you help.", "Rest well, and keep your mind on one hopeful thing each day."]
    : [`What to do: ${cap(L.move[o])}.`, step[grp]];
  if (!Q.health) doThis.push(`If you can, take that step on a ${A.weekday}, the day of ${A.day === "Sun" || A.day === "Moon" ? "the " + A.day : A.day}, which governs this card.`);
  out.push(doThis.join(" "));
  out.push(`Watch for: ${L.omen[o]}. When you see it, you will know this reading is unfolding.`);

  // 6. The cards passed over
  const passed = others.filter((x) => x.index !== card.index);
  if (passed.length === 2) {
    const [a, b] = passed.map((x) => DECK[x.index]);
    out.push(fill(pick(PASSED), { a: a.name, b: b.name, A: a.name, B: b.name, ka: firstKw(a), kb: firstKw(b) }));
  }

  // 7. Guidance
  const advice = reversed ? C.advRev : card.adv;
  out.push(`My guidance${name && R() < 0.4 ? `, ${name}` : ""}: ${advice}`);

  return out.join("\n\n");
}
