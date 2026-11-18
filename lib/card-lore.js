// More of Mira's knowledge, in DECK order: a concrete action for each card (upright, reversed),
// signs to watch for, and where new people or chances tend to come from under this card.
// Drawn from the traditional Rider-Waite-Smith meanings and the cards' imagery.

export const LORE = [
  { // 0 The Fool
    move: { up: "take the first small step this week, before you feel fully ready, and let the next step show itself", rev: "write down the one risk you have been ignoring, and decide whether you can live with it before you jump" },
    omen: { up: "an unplanned invitation, a dog, a white flower, or a chance to go somewhere new on short notice", rev: "a near miss, something dropped or forgotten, or someone urging you to hurry" },
    where: "a trip, a new hobby, or a place you have never been",
  },
  { // I The Magician
    move: { up: "make the call, send the pitch or ask directly, using a skill you already have; do not wait to be invited", rev: "check every promise for proof, including your own, and cut your plan down to one goal" },
    omen: { up: "a message on a Wednesday, a tool or gadget that turns up just when you need it, numbers repeating", rev: "a smooth talker, a deal that keeps changing, or plans that look better on paper than in person" },
    where: "work, a class, or through a skill you share with someone",
  },
  { // II The High Priestess
    move: { up: "say less for now; listen, observe, and keep your plans to yourself until you know more", rev: "stop ignoring the gut feeling you keep pushing away; write it down and act on it" },
    omen: { up: "vivid dreams, a secret shared with you, the full moon, or a woman who quietly guides you", rev: "gossip, a hidden agenda coming to light, or advice that contradicts your instinct" },
    where: "a quiet, spiritual or learning space, or through someone who has been there all along",
  },
  { // III The Empress
    move: { up: "invest care and time in what you want to grow: nourish it, make it beautiful, and be patient as it ripens", rev: "look after yourself first; you cannot keep giving from an empty cup, so take back one hour a day for you" },
    omen: { up: "flowers or a garden, an invitation to a celebration, a pregnancy or birth announcement, a generous gift", rev: "feeling smothered or taken for granted, or a creative project that has gone dry" },
    where: "friends, family gatherings, celebrations, or creative circles",
  },
  { // IV The Emperor
    move: { up: "put structure on it: a written plan, a deadline and one clear decision, and then hold your ground", rev: "find out who is really in control here, and stop handing your authority to someone who abuses it" },
    omen: { up: "a father figure, a boss or official, a contract or formal letter, a firm deadline", rev: "a rigid rule, a power struggle, or an older man who tries to control the outcome" },
    where: "work, an office or an official setting, or through an older or established person",
  },
  { // V The Hierophant
    move: { up: "follow the proven route: ask a mentor, go through the proper channel, and get it in writing", rev: "question the rule you have been following; ask whether it is yours or someone else's" },
    omen: { up: "a teacher or elder, a religious occasion or ceremony, an exam or qualification, family approval", rev: "pressure to conform, a family objection, or advice that no longer fits you" },
    where: "family introductions, a place of worship, a course, or a traditional setting",
  },
  { // VI The Lovers
    move: { up: "make a choice that matches your values and say it out loud; do not keep both doors half open", rev: "be honest about the gap between what you say and what you do, and close it" },
    omen: { up: "a meaningful conversation, a choice between two options, a pair of something, a strong mutual attraction", rev: "mixed signals, a third person, or a decision you keep putting off" },
    where: "conversation, shared interests, or a friend who introduces you",
  },
  { // VII The Chariot
    move: { up: "commit fully and move: set a target date, drive towards it, and do not let the two sides of you pull in different directions", rev: "stop pushing for a moment; decide where you are actually trying to go before you go faster" },
    omen: { up: "travel or a vehicle, a competition or test you can win, a sudden green light", rev: "delays in travel, a project losing direction, or anger getting in the way" },
    where: "travel, a commute, or a goal you are both chasing",
  },
  { // VIII Strength
    move: { up: "stay calm and kind but firm; handle the situation gently and do not back down", rev: "rebuild your confidence with one small win before you take on the big fight" },
    omen: { up: "a cat or a lion image, someone difficult softening, a test of patience you pass", rev: "self-doubt, a temper flaring, or being tempted to give up just before it turns" },
    where: "a place where you are calm and yourself, or through someone who admires your patience",
  },
  { // IX The Hermit
    move: { up: "step back from the noise, think it through alone, and talk to one wise, older person before deciding", rev: "come out of hiding; you have thought enough, and now you need people and fresh air" },
    omen: { up: "a lamp or a light left on, an older mentor, a quiet invitation to step away, a book that answers you", rev: "loneliness that has gone on too long, or someone shutting you out" },
    where: "study, a mentor, a retreat, or a slow friendship that deepens quietly",
  },
  { // X Wheel of Fortune
    move: { up: "say yes to the opening that appears; luck is turning, and it rewards people who move with it", rev: "do not fight a turn you cannot control; protect what you have and wait for the wheel to come back up" },
    omen: { up: "a lucky coincidence, a sudden change of plans that works out, the same opportunity coming back round", rev: "a setback you did not cause, or a pattern repeating that you need to break" },
    where: "chance, timing, or someone from your past coming back round",
  },
  { // XI Justice
    move: { up: "put the facts in writing and act fairly; whatever is decided now will be balanced and binding", rev: "check the paperwork twice, ask for what is fair, and own your part in the imbalance" },
    omen: { up: "a document, contract or signature, a fair decision in your favour, a set of scales or balance", rev: "an unfair decision, missing information, or someone avoiding accountability" },
    where: "work, paperwork, or a mutual friend who is honest with both of you",
  },
  { // XII The Hanged Man
    move: { up: "pause on purpose; look at it from the other side for a few days before you act", rev: "stop waiting for the perfect moment; decide something, even something small, by the next new moon" },
    omen: { up: "a delay that turns out to be a gift, a new way of seeing things, an unexpected pause", rev: "being stuck in limbo, sacrificing too much, or a decision that keeps being postponed" },
    where: "a slow, unexpected place, after a pause or a change of plans",
  },
  { // XIII Death
    move: { up: "end what is already over: the job, habit or story that has run its course, so the new thing has room", rev: "let go of the thing you are clinging to; the change is coming either way, and resisting only makes it slower" },
    omen: { up: "an ending that clears space, a door closing, a big change in routine, an old chapter wrapping up", rev: "repeating the same situation, fear of change, or something dragging on long past its time" },
    where: "a new chapter that begins only after an old one closes",
  },
  { // XIV Temperance
    move: { up: "go slowly and mix the two sides; take the middle path and give it steady, patient effort", rev: "cut back on the excess, whether spending, work or worry, and bring your days back into balance" },
    omen: { up: "healing, a slow improvement, a peaceful compromise, an angel image or water", rev: "overdoing something, impatience, or two sides that refuse to meet" },
    where: "a calm, healing place, or a gradual friendship that blends naturally",
  },
  { // XV The Devil
    move: { up: "name the habit, fear or person that has a hold on you, and take one concrete step to loosen it", rev: "you are already halfway free; cut the last tie and do not go back for one more try" },
    omen: { up: "temptation, an obsession, a deal that ties you down, money or desire clouding judgement", rev: "breaking free, seeing a manipulation clearly, or an addiction loosening its grip" },
    where: "intense or tempting places; go carefully",
  },
  { // XVI The Tower
    move: { up: "let the false structure fall and do not rebuild it the same way; face the truth that has come out", rev: "make the change yourself now, before circumstances force it on you" },
    omen: { up: "sudden news, a shock that clears the air, a plan collapsing to make room, lightning or a storm", rev: "a crisis narrowly avoided, or a change you keep sensing but resisting" },
    where: "an unexpected upheaval that throws you together with someone",
  },
  { // XVII The Star
    move: { up: "share what you hope for openly; apply, reach out, put your work where people can see it", rev: "rebuild your faith with one small promise to yourself, kept every day" },
    omen: { up: "a hopeful message, healing, someone generous, stars on a clear night, a creative breakthrough", rev: "feeling disconnected or discouraged, or losing faith just before the turn" },
    where: "online, through creative work, or a community you feel hopeful in",
  },
  { // XVIII The Moon
    move: { up: "do not decide on half the facts; wait for clarity, check what you are told, and trust your intuition", rev: "the fog is lifting; ask the direct question you have been avoiding and believe the answer" },
    omen: { up: "confusing signals, dreams, secrets, rumours, a dog howling at night, the full moon", rev: "a truth coming out, anxiety easing, or a misunderstanding being cleared up" },
    where: "night-time, dreams, or someone whose intentions are not yet clear",
  },
  { // XIX The Sun
    move: { up: "go ahead openly and confidently; tell people, celebrate, and let yourself be seen", rev: "lower your expectations a little and enjoy the good that is already here" },
    omen: { up: "good news, a success, a child, a sunny day, recognition, a reason to celebrate", rev: "a cloud over good news, a short delay, or a success that feels smaller than hoped" },
    where: "daylight, celebrations, or warm, sociable places",
  },
  { // XX Judgement
    move: { up: "answer the call you have been hearing; make the decision you already know is right", rev: "stop judging yourself for the past; forgive it and choose again" },
    omen: { up: "a call or message from the past, a second chance, a final decision, a wake-up moment", rev: "self-doubt, avoiding a decision, or an old regret coming back" },
    where: "someone from the past, a reunion, or a second chance",
  },
  { // XXI The World
    move: { up: "finish what you started and close the cycle properly; completion opens the next door", rev: "find the one loose end you have left untied, and tie it before you move on" },
    omen: { up: "a completion, a graduation or certificate, travel abroad, a sense of everything coming together", rev: "a delay at the last step, or one thing left undone" },
    where: "travel, abroad, or the end of a long journey",
  },
];
