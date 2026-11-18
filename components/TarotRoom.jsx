"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { DECK } from "@/lib/tarot";
import { audio } from "@/lib/audio";
import { RELATIONSHIP } from "@/lib/profile";
import { chart } from "@/lib/astro";

const CHIPS = ["Should I change my job this year?", "What does my love life need right now?", "Will my finances improve soon?", "What should I focus on today?"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = (url, body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
const rupees = (paise) => `₹${Math.round(paise / 100)}`;
const any = (arr) => arr[Math.floor(Math.random() * arr.length)];
const EMPTY_PROFILE = { name: "", dob: "", birthPlace: "", city: "", work: "", relationship: "" };
const needsProfile = (u) => !!u && (!u.name || !u.profile?.dob);
// Reading text: a paragraph that starts with a known label ("When:", "What to do:"...) shows the label in bold.
const LABEL = /^(Answer|Why I read it this way|When|What to do|Watch for|My guidance(?:, [^:]+)?):\s*/;
const Para = ({ text }) => { const m = text.match(LABEL); return m ? <p><b>{m[1]}:</b> {text.slice(m[0].length)}</p> : <p>{text}</p>; };

// Mira never says the same thing every time.
const LINES = {
  breath: ["Before I shuffle, breathe with me. In… and slowly out.", "Close your eyes for a moment. Breathe in with me… and let it go.", "Let the room go quiet. Breathe in… and out.", "Rest your hands. Breathe in slowly… now release it."],
  riffle: ["I split the deck in two, and let the halves fall together…", "Two halves of the same story. Watch them weave into one.", "Let the cards fall where they will…"],
  overhand: ["Packet by packet, the deck forgets its old order…", "I let the cards slip through my fingers, a few at a time…", "Hold your question steady while the deck turns over…"],
  wash: ["I spread them across the cloth, like water. Keep your question close.", "Let them swirl. The deck must lose its memory before it can speak.", "Round and round on the velvet… the cards are listening."],
  again: ["Once more, to be certain.", "And again…", "One more pass."],
  cut: ["Now it is your turn. Cut the deck: touch the pile that should rise to the top.", "Your hand must touch the deck too. Choose a pile, and it will rise.", "Two piles now. Choose the one that feels warmer, and I will place it on top."],
  cutDone: ["So it rises. The deck is yours now.", "Good. Your choice is in the cards.", "It is done. The deck carries your touch."],
  deal: ["Three cards. Only one of them is yours.", "Three paths lie on the cloth. One is meant for you.", "The deck has offered three. You will choose one.", "Three cards, face down. Look at them a while."],
  choose: ["Breathe slowly… now press and hold the card that calls to you.", "Don't think. Let your hand find the card that pulls at you, and hold it.", "One of them is warmer than the others. Press and hold it.", "Trust the first card your eyes return to. Hold it."],
  again2: ["Another question stirs in you. Ask it, and I will shuffle again.", "The deck is ready again. What else do you carry?", "Ask, and the cards will begin anew."],
};

export default function TarotRoom() {
  const canvasRef = useRef(null), sceneRef = useRef(null), ringRef = useRef(null), arcRef = useRef(null);
  const [me, setMe] = useState(null), [cfg, setCfg] = useState(null);
  const [phase, setPhaseState] = useState("loading"); const phaseRef = useRef("loading");
  const setPhase = (p) => { phaseRef.current = p; setPhaseState(p); };
  const [line, setLine] = useState(""), [sound, setSound] = useState(false);
  const [question, setQuestion] = useState(""), [emailIn, setEmailIn] = useState(""), [codeIn, setCodeIn] = useState(""), [codeSent, setCodeSent] = useState(false), [devCode, setDevCode] = useState(""), [phone, setPhone] = useState(""), [keyMode, setKeyMode] = useState(false), [keyIn, setKeyIn] = useState("");
  const [reading, setReading] = useState(null), [modal, setModal] = useState(null), [notice, setNotice] = useState("");
  const [history, setHistory] = useState(null), [breathIn, setBreathIn] = useState(false), [busy, setBusy] = useState(false);
  const [force, setForce] = useState({ index: "", orient: "", ritual: "on" });
  const [prof, setProf] = useState(EMPTY_PROFILE);
  const run = useRef(0), readingId = useRef(null), sayTok = useRef(0), queue = useRef(Promise.resolve()), skipBreath = useRef(null), meRef = useRef(null), forceRef = useRef(force);
  meRef.current = me; forceRef.current = force;

  /* Mira speaks: subtitle + moving lips (no spoken voice). Resolves when the line has had time to be read. */
  const say = useCallback((text) => {
    const tok = ++sayTok.current; setLine(text); sceneRef.current?.setTalking(true);
    return audio.speak(text).then(() => { if (sayTok.current === tok) sceneRef.current?.setTalking(false); });
  }, []);
  const enqueue = (text, r) => { queue.current = queue.current.then(() => (run.current === r ? say(text) : null)); };
  const interrupt = () => { run.current++; queue.current = Promise.resolve(); audio.hush(); };

  const loadMe = useCallback(async () => {
    const d = await fetch("/api/me", { cache: "no-store" }).then((r) => r.json());
    setMe(d.user); setCfg(d.config); return d;
  }, []);

  useEffect(() => {
    let scene, dead = false;
    (async () => {
      const [{ createScene }] = await Promise.all([import("./scene"), loadMe(), document.fonts?.ready]);
      if (dead) return;
      try {
        scene = createScene(canvasRef.current, {
          onPick: (i) => pick(i),
          onShortTap: () => say("Hold it a moment longer… let the card feel your touch."),
          onShuffleStyle: (style, second) => say(second ? `${any(LINES.again)} ${any(LINES[style])}` : any(LINES[style])),
          onHold: (p, x, y) => {
            const ring = ringRef.current; if (!ring) return;
            if (p == null) { ring.hidden = true; return; }
            if (x != null) { ring.style.left = x + "px"; ring.style.top = y + "px"; }
            ring.hidden = false; arcRef.current.setAttribute("stroke-dashoffset", (201 * (1 - p)).toFixed(1));
          },
        });
        sceneRef.current = scene; setPhase("intro");
      } catch (err) { console.error(err); setPhase("nogl"); }
    })();
    try { const q = sessionStorage.getItem("mira_q"); if (q) setQuestion(q); } catch { /* storage blocked */ }
    try { const ph = localStorage.getItem("mira_phone"); if (ph) setPhone(ph); } catch { /* storage blocked */ }
    const returned = new URLSearchParams(location.search).get("order_id");
    if (returned) {
      history.replaceState(null, "", location.pathname);
      confirmPayment(returned).then((msg) => { if (msg) { setNotice(msg); setModal("paywall"); } });
    }
    return () => { dead = true; scene?.dispose(); audio.setSound(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleSound() { const v = !sound; setSound(v); audio.setSound(v); }

  async function enter(withSound) {
    setSound(withSound); audio.setSound(withSound); sceneRef.current.enter(); setPhase("entering");
    await sleep(1500);
    const u = meRef.current;
    if (needsProfile(u)) { setPhase("ask"); openProfile("Welcome, seeker. I am Mira. Before the cards can speak to you, tell me who you are."); return; }
    setPhase("ask");
    if (u?.name && u.lastCard) say(`Welcome back, ${u.name}. Last time, the cards showed you ${u.lastCard}. What weighs on you tonight?`);
    else if (u?.name) say(`Welcome, ${u.name}. Ask the one question that sits heavy on your heart.`);
    else say("Welcome, seeker. I am Mira. Sit with me a while, and ask the one question that sits heavy on your heart.");
  }

  function openProfile(line) {
    const u = meRef.current, p = u?.profile || {};
    setProf({ ...EMPTY_PROFILE, ...p, relationship: p.relationship || "", name: u?.name || "" });
    setNotice(""); setModal("profile");
    if (line) say(line);
  }

  async function saveProfile(e) {
    e.preventDefault(); if (busy) return; setNotice(""); setBusy(true);
    const res = await post("/api/me", { ...prof, relationship: prof.relationship || "private" }); const d = await res.json().catch(() => ({})); setBusy(false);
    if (!res.ok) { setNotice(d.error || "Something went wrong. Try again."); return; }
    setMe((m) => ({ ...m, name: d.user.name, profile: d.user.profile })); setModal(null);
    if (phaseRef.current !== "ask") return;
    const c = chart(d.user.profile);
    const bc = c.birthCards.map((i) => DECK[i].name).join(" and ");
    say(`${d.user.name}. Born under ${c.sun.name}, ${/^[aeiou]/.test(c.sun.element) ? "an" : "a"} ${c.sun.element} sign, on a life path of ${c.lifePath}. Your birth card${c.birthCards.length > 1 ? "s are" : " is"} ${bc}. Now I know who sits across from me. Ask your question.`);
  }

  async function ask(e) {
    e?.preventDefault(); if (phaseRef.current !== "ask" || busy) return;
    const q = question.trim();
    if (q.length < 4) { say("Speak your question first. The cards answer what you truly ask."); return; }
    if (!meRef.current) {
      try { sessionStorage.setItem("mira_q", q); } catch { /* storage blocked */ }
      setModal("signin"); say("Before I shuffle, tell me who sits across from me."); return;
    }
    if (needsProfile(meRef.current)) { openProfile("One moment. The cards read you through your birth date. Tell me about yourself first."); return; }
    setBusy(true); const res = await post("/api/reading/start", { question: q }); const d = await res.json().catch(() => ({})); setBusy(false);
    if (res.status === 401) { setModal("signin"); return; }
    if (res.status === 402) { openPaywall(); return; }
    if (!res.ok) { say(d.error || "Something disturbed the cards. Ask me once more."); return; }
    try { sessionStorage.removeItem("mira_q"); } catch { /* storage blocked */ }
    interrupt(); const r = run.current; readingId.current = d.id; const scene = sceneRef.current;

    if (!(meRef.current.isAdmin && forceRef.current.ritual === "off")) {
      setPhase("breath"); scene.setThinking(true); say(any(LINES.breath));
      let skipped = false; const skip = new Promise((res2) => (skipBreath.current = () => { skipped = true; res2(); }));
      await Promise.race([skip, (async () => {
        await sleep(300); if (skipped) return; setBreathIn(true); scene.setBreath(1); audio.bell(392, 0.03);
        await sleep(4200); if (skipped) return; setBreathIn(false); scene.setBreath(0); audio.bell(329.6, 0.03);
        await sleep(4200);
      })()]);
      setBreathIn(false); scene.setBreath(0); scene.setThinking(false);
      if (run.current !== r) return;
    }
    setPhase("shuffling"); await sleep(300); await scene.shuffle();
    if (run.current !== r) return;
    if (!(meRef.current.isAdmin && forceRef.current.ritual === "off")) {
      setPhase("cut"); say(any(LINES.cut));
      await scene.cut();
      if (run.current !== r) return;
      setPhase("shuffling"); say(any(LINES.cutDone)); await sleep(900);
    }
    say(any(LINES.deal)); await scene.deal();
    if (run.current !== r) return;
    setPhase("choose"); scene.setChoosing(true); say(any(LINES.choose));
  }

  async function pick(i) {
    if (phaseRef.current !== "choose") return;
    setPhase("reveal"); const scene = sceneRef.current, r = run.current; scene.setChoosing(false);
    say("Ah… let me turn it over.");
    const f = forceRef.current, u = meRef.current;
    const body = { id: readingId.current, pick: i };
    if (u?.isAdmin && (f.index !== "" || f.orient)) body.force = { index: f.index === "" ? null : Number(f.index), orient: f.orient };
    const res = await post("/api/reading/pick", body); const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      await scene.putBack(); setPhase("ask");
      if (res.status === 402) openPaywall(); else say(d.error || "The cards slipped from my hands. Ask me once more.");
      return;
    }
    setMe((m) => ({ ...m, credits: d.credits }));
    const card = DECK[d.card.index], reversed = d.card.reversed;
    await scene.reveal(i, card, reversed);
    if (run.current !== r) return;
    setPhase("reading"); setReading({ card, reversed, question: question.trim(), text: "", done: false });
    streamReading(readingId.current, r);
  }

  async function streamReading(id, r) {
    let full = "", spoken = 0;
    try {
      const res = await fetch(`/api/reading/text?id=${id}`);
      const reader = res.body.getReader(), dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        full += dec.decode(value, { stream: true }); if (run.current !== r) return;
        setReading((x) => x && { ...x, text: full });
        const re = /[^.!?…]+[.!?…]+["”']?\s/g; re.lastIndex = spoken; let m;
        while ((m = re.exec(full))) { enqueue(m[0].trim(), r); spoken = re.lastIndex; }
      }
    } catch (err) { console.error(err); }
    if (run.current !== r) return;
    const tail = full.slice(spoken).trim(); if (tail) enqueue(tail, r);
    if (!full) { full = "The cards have gone quiet for a moment. Your reading is saved in your journal, so look there shortly."; enqueue(full, r); }
    setReading((x) => x && { ...x, text: full, done: true });
  }

  async function askAgain() {
    interrupt(); sceneRef.current.setTalking(false); setReading(null); setQuestion(""); setPhase("resetting");
    await sceneRef.current.putBack(); setPhase("ask");
    const u = meRef.current;
    if (u && u.credits < 1 && !u.isAdmin) openPaywall();
    else say(any(LINES.again2));
  }

  function openPaywall() { setNotice(""); setModal("paywall"); say("The deck still has much to tell you, but your free readings are spent."); }

  // Asks the server whether an order is paid and, if so, refreshes the credits. Returns an error message or "".
  async function confirmPayment(orderId) {
    const v = await post("/api/pay/verify", { orderId }); const vd = await v.json().catch(() => ({}));
    if (!v.ok) return vd.error || "We could not confirm the payment. If money was deducted, your questions will appear within a few minutes.";
    if (!vd.paid) return "The payment didn't go through, so nothing was charged. You can try again.";
    setMe((m) => (m ? { ...m, credits: vd.credits } : m)); setModal(null);
    say("The cards welcome you back. Ask, and I will shuffle.");
    return "";
  }

  async function loadScript(src) {
    if (document.querySelector(`script[src="${src}"]`)) return;
    await new Promise((ok, bad) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = bad; document.body.appendChild(s); });
  }

  async function buy(packId) {
    if (busy) return; setNotice("");
    const pay = cfg?.payment;
    if (!pay) { setNotice("Payments are not set up yet."); return; }
    if (pay.provider === "cashfree" && !/^(\+?91|0)?[6-9]\d{9}$/.test(phone.replace(/[\s-]/g, ""))) { setNotice("Enter your 10-digit mobile number. The payment partner needs it for the receipt."); return; }
    setBusy(true);
    try {
      const res = await post("/api/pay/order", { pack: packId, phone }); const d = await res.json();
      if (!res.ok) { setNotice(d.error || "Could not start the payment."); return; }
      if (d.provider === "cashfree") {
        try { localStorage.setItem("mira_phone", phone); } catch { /* storage blocked */ }
        await loadScript("https://sdk.cashfree.com/js/v3/cashfree.js");
        const result = await window.Cashfree({ mode: pay.mode }).checkout({ paymentSessionId: d.paymentSessionId, redirectTarget: "_modal" });
        if (result?.redirect) return; // the page will come back with ?order_id=
        const msg = await confirmPayment(d.orderId);
        if (msg && !result?.error) setNotice(msg);
        else if (msg) setNotice("The payment window was closed before paying. Nothing was charged.");
        return;
      }
      await loadScript("https://checkout.razorpay.com/v1/checkout.js");
      new window.Razorpay({
        key: d.key, order_id: d.orderId, amount: d.amount, currency: "INR",
        name: "Mira's Tarot Room", description: "Tarot questions", prefill: { email: d.email, name: d.name }, theme: { color: "#6a1d33" },
        handler: async (resp) => {
          const v = await post("/api/pay/verify", resp); const vd = await v.json();
          if (!v.ok) { setNotice(vd.error || "We could not confirm the payment. If money was deducted, your questions will appear within a few minutes."); return; }
          setMe((m) => ({ ...m, credits: vd.credits })); setModal(null);
          say("The cards welcome you back. Ask, and I will shuffle.");
        },
      }).open();
    } catch (err) { console.error(err); setNotice("The payment window could not open. Check your connection and try again."); }
    finally { setBusy(false); }
  }

  async function openJournal() {
    setModal("journal"); setHistory(null);
    const d = await fetch("/api/history").then((r) => r.json()).catch(() => ({ readings: [] }));
    setHistory(d.readings || []);
  }

  async function sendCode(e) {
    e?.preventDefault(); if (busy) return; setNotice(""); setBusy(true);
    const res = await post("/api/auth/code", { email: emailIn }); const d = await res.json().catch(() => ({})); setBusy(false);
    if (!res.ok) { setNotice(d.error || "We couldn't send the code."); return; }
    setCodeSent(true); setCodeIn(""); setDevCode(d.devCode || "");
  }

  async function adminSignIn(e) {
    e.preventDefault(); if (busy) return; setNotice(""); setBusy(true);
    const r = await signIn("admin-key", { email: emailIn, key: keyIn, redirect: false }); setBusy(false);
    if (!r || r.error) { setNotice("That email and admin key don't match."); return; }
    setKeyIn(""); setKeyMode(false);
    const d = await loadMe(); setModal(null);
    if (needsProfile(d.user)) openProfile("Welcome home. Tell me about yourself, so the cards can read you properly.");
    else say(`Welcome back, ${d.user?.name || "seeker"}. The deck is open to you without limit.`);
  }

  async function verifyCode(e) {
    e.preventDefault(); if (busy) return; setNotice(""); setBusy(true);
    const r = await signIn("email-code", { email: emailIn, code: codeIn, redirect: false }); setBusy(false);
    if (!r || r.error) { setNotice("That code didn't match, or it has expired. Check it, or send a new one."); return; }
    const d = await loadMe(); setModal(null); setCodeSent(false); setDevCode("");
    if (needsProfile(d.user)) openProfile("Welcome. Tell me about yourself, so the cards can read you properly.");
    else say(d.user?.name ? `Welcome back, ${d.user.name}. Ask, and I will shuffle.` : "Good. Now ask, and I will shuffle.");
  }

  const admin = me?.isAdmin, credits = me?.credits ?? 0;
  const creditLabel = !me ? "3 free readings" : admin ? "Unlimited readings" : credits > 0 ? `${credits} reading${credits === 1 ? "" : "s"} left` : "No readings left";

  return (
    <>
      <canvas ref={canvasRef} id="scene" aria-label="A candlelit room where Mira, a tarot reader, sits at a table with a deck of cards and a crystal ball" />
      <div className="vignette" />

      <div className={"ui" + (reading ? " with-reading" : "")}>
        <header>
          <div className="brand">Mira&apos;s Tarot Room<small>one question · one card · one answer</small></div>
          <div className="hud">
            {admin && <button className="adminbadge" onClick={() => setModal(modal === "admin" ? null : "admin")}>ADMIN</button>}
            <button className="pill" onClick={() => (me ? setModal("paywall") : setModal("signin"))} title="Get more readings">{creditLabel}</button>
            {me && <button className="iconbtn" onClick={() => openProfile()}>Your details</button>}
            {me && <button className="iconbtn" onClick={openJournal}>Journal</button>}
            <button className="iconbtn" aria-pressed={sound} onClick={toggleSound}>{sound ? "Sound on" : "Sound off"}</button>
            {me ? <button className="iconbtn" onClick={() => signOut()}>Sign out</button> : phase !== "intro" && phase !== "loading" && <button className="iconbtn" onClick={() => setModal("signin")}>Sign in</button>}
          </div>
        </header>

        <div className="bottom">
          <div className="subtitle" aria-live="polite"><div className="who">MIRA</div><p id="speech" key={line}>{line}</p></div>

          {phase === "ask" && (
            <form className="dock" onSubmit={ask} autoComplete="off">
              <div className="ask">
                <input id="q" maxLength={200} placeholder="Ask Mira your question…" value={question} onChange={(e) => setQuestion(e.target.value)} aria-label="Your question" />
                <button className="cta" type="submit" disabled={busy}>Ask Mira</button>
              </div>
              <div className="chips">{CHIPS.map((c) => <button type="button" className="chip" key={c} onClick={() => setQuestion(c)}>{c}</button>)}</div>
            </form>
          )}
          {phase === "cut" && (
            <div className="dock">
              <p className="pickhint">Touch a pile on the table, or choose here. It goes on top.</p>
              <div className="picks">{["Left pile", "Right pile"].map((l, i) => <button className="ghost" key={l} onClick={() => sceneRef.current?.chooseCut(i)}>{l}</button>)}</div>
            </div>
          )}
          {phase === "choose" && (
            <div className="dock">
              <p className="pickhint">Press and hold the card that calls to you, or choose here.</p>
              <div className="picks">{["Left card", "Middle card", "Right card"].map((l, i) => <button className="ghost" key={l} onClick={() => pick(i)}>{l}</button>)}</div>
            </div>
          )}
        </div>
      </div>

      {reading && (
        <aside className="reading">
          <p className="q">“{reading.question}”</p>
          <h2>{reading.card.name}</h2>
          <span className="tag">{reading.reversed ? "REVERSED" : "UPRIGHT"}</span>
          <p className="kw">{reading.card.kw.toUpperCase()}</p>
          <div className="rtext">{reading.text ? reading.text.split(/\n+/).map((p, i) => <Para key={i} text={p} />) : <p className="waiting">Mira studies the card…</p>}</div>
          {reading.done && <button className="cta" onClick={askAgain}>Ask another question</button>}
          <p className="disclaim">For reflection and entertainment.</p>
        </aside>
      )}

      {phase === "breath" && (
        <div className="breath"><div className="breath-inner">
          <div className={"breath-ring" + (breathIn ? " in" : "")}><span className="breath-word">{breathIn ? "BREATHE IN" : "BREATHE OUT"}</span></div>
          <button className="ghost" onClick={() => skipBreath.current?.()}>Skip</button>
        </div></div>
      )}

      <svg className="holdring" ref={ringRef} viewBox="0 0 74 74" hidden aria-hidden="true">
        <circle className="bg" cx="37" cy="37" r="32" />
        <circle className="fg" ref={arcRef} cx="37" cy="37" r="32" strokeDasharray="201" strokeDashoffset="201" transform="rotate(-90 37 37)" />
      </svg>

      {(phase === "loading" || phase === "intro") && (
        <div className="intro"><div className="intro-inner">
          <div className="eyebrow">A CANDLELIT READING</div>
          <h1>Mira&apos;s Tarot Room</h1>
          <p>Sit at her table, ask one question, and draw the card meant for you.</p>
          <div className="row">
            <button className="cta" disabled={phase !== "intro"} onClick={() => enter(true)}>Enter with sound</button>
            <button className="ghost" disabled={phase !== "intro"} onClick={() => enter(false)}>Enter quietly</button>
          </div>
          <span className="small">{phase === "intro" ? "Best with headphones. Your first three readings are free." : "Lighting the candles…"}</span>
        </div></div>
      )}
      {phase === "nogl" && <div className="nogl"><p>This experience needs WebGL. Try a recent version of Chrome, Safari or Firefox.</p></div>}

      {modal === "signin" && (
        <div className="veil" role="dialog" aria-modal="true" aria-labelledby="siT"><div className="offer">
          <h3 id="siT">Who sits across from Mira?</h3>
          <p>Sign in so the cards remember you. Your first {3} readings are free, and every reading is kept in your journal.</p>
          {keyMode ? (
            <form className="devlogin" onSubmit={adminSignIn}>
              <input id="aem" type="email" autoComplete="email" placeholder="Admin email" value={emailIn} onChange={(e) => setEmailIn(e.target.value)} aria-label="Admin email" autoFocus />
              <input id="akey" type="password" autoComplete="current-password" placeholder="Admin key" value={keyIn} onChange={(e) => setKeyIn(e.target.value)} aria-label="Admin key" />
              <button className="cta" disabled={busy || !keyIn}>Sign in as admin</button>
              <button type="button" className="linkbtn" onClick={() => { setKeyMode(false); setNotice(""); }}>Back to email code</button>
            </form>
          ) : !codeSent ? (
            <form className="devlogin" onSubmit={sendCode}>
              <input id="em" type="email" autoComplete="email" placeholder="you@example.com" value={emailIn} onChange={(e) => setEmailIn(e.target.value)} aria-label="Email address" autoFocus />
              <button className="cta" disabled={busy}>Send me a code</button>
            </form>
          ) : (
            <form className="devlogin" onSubmit={verifyCode}>
              <p className="note">We sent a 6-digit code to <b>{emailIn}</b>. It expires in 10 minutes.</p>
              <input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••" value={codeIn} onChange={(e) => setCodeIn(e.target.value.replace(/\D/g, ""))} aria-label="Sign-in code" className="codein" autoFocus />
              <button className="cta" disabled={busy || codeIn.length !== 6}>Sign in</button>
              {devCode && <p className="note">Development mode, no email is sent. Your code is <b>{devCode}</b>.</p>}
              <button type="button" className="linkbtn" onClick={() => { setCodeSent(false); setNotice(""); }}>Use a different email or resend</button>
            </form>
          )}
          {notice && <p className="err">{notice}</p>}
          {cfg?.adminKey && !keyMode && <button className="linkbtn" onClick={() => { setKeyMode(true); setNotice(""); }}>I have an admin key</button>}
          <p className="note">By continuing you agree to the <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.</p>
          <button className="linkbtn" onClick={() => setModal(null)}>Not now</button>
        </div></div>
      )}

      {modal === "paywall" && (
        <div className="veil" role="dialog" aria-modal="true" aria-labelledby="pwT"><div className="offer">
          <h3 id="pwT">The cards want to say more</h3>
          <p>{credits > 0 || admin ? "Add more questions to your account. They never expire." : "Your free readings are spent. Keep asking Mira with a pack of questions."}</p>
          <div className="packs">
            {(cfg?.packs || []).map((p, i) => (
              <button key={p.id} className={"pack" + (i === 0 ? " best" : "")} disabled={busy} onClick={() => buy(p.id)}>
                <span className="price">{rupees(p.amount)}</span>
                <span className="plabel">{p.label.toUpperCase()}</span>
                <span className="per">₹{(p.amount / 100 / p.credits).toFixed(1)} each</span>
              </button>
            ))}
          </div>
          {cfg?.payment?.provider === "cashfree" && (
            <label className="phonein">Mobile number (for your payment receipt)
              <input id="ph" type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
          )}
          {notice && <p className="err">{notice}</p>}
          <p className="note">{cfg?.payment ? `Secure payment by ${cfg.payment.provider === "cashfree" ? "Cashfree" : "Razorpay"}: UPI, cards, netbanking and wallets.` : "Payments are not set up yet."} See the <a href="/refunds">refund policy</a>.</p>
          <button className="linkbtn" onClick={() => setModal(null)}>Not now</button>
        </div></div>
      )}

      {modal === "profile" && (
        <div className="veil" role="dialog" aria-modal="true" aria-labelledby="pfT"><div className="offer profile">
          <h3 id="pfT">Tell Mira about yourself</h3>
          <p className="note">Mira reads your card through your birth date (sun sign, numerology and birth cards) and the life you are living now. Only you can see these details.</p>
          <form className="pform" onSubmit={saveProfile} autoComplete="on">
            <label><span>Your name <b className="req" aria-hidden="true">*</b></span>
              <input id="pf-name" maxLength={30} autoComplete="given-name" value={prof.name} onChange={(e) => setProf({ ...prof, name: e.target.value })} autoFocus />
            </label>
            <label><span>Date of birth <b className="req" aria-hidden="true">*</b></span>
              <input id="pf-dob" type="date" min="1920-01-01" max={new Date().toISOString().slice(0, 10)} autoComplete="bday" value={prof.dob} onChange={(e) => setProf({ ...prof, dob: e.target.value })} />
            </label>
            <label>Where you were born
              <input id="pf-bp" maxLength={60} placeholder="City or town" value={prof.birthPlace} onChange={(e) => setProf({ ...prof, birthPlace: e.target.value })} />
            </label>
            <label>Where you live now
              <input id="pf-city" maxLength={60} autoComplete="address-level2" placeholder="City" value={prof.city} onChange={(e) => setProf({ ...prof, city: e.target.value })} />
            </label>
            <label>Your work
              <input id="pf-work" maxLength={60} autoComplete="organization-title" placeholder="e.g. teacher, student, engineer" value={prof.work} onChange={(e) => setProf({ ...prof, work: e.target.value })} />
            </label>
            <label>Relationship
              <select id="pf-rel" value={prof.relationship} onChange={(e) => setProf({ ...prof, relationship: e.target.value })}>
                <option value="">Choose…</option>
                {RELATIONSHIP.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
            <button className="cta" type="submit" disabled={busy || !prof.name.trim() || !prof.dob}>{me?.profile?.dob ? "Save" : "This is me"}</button>
          </form>
          {notice && <p className="err">{notice}</p>}
          {me?.profile?.dob && <button className="linkbtn" onClick={() => setModal(null)}>Close</button>}
        </div></div>
      )}

      {modal === "journal" && (
        <div className="veil" role="dialog" aria-modal="true" aria-labelledby="jT"><div className="offer journal">
          <h3 id="jT">Your journal</h3>
          {!history && <p className="note">Opening the pages…</p>}
          {history && history.length === 0 && <p className="note">Your readings will be kept here after your first card.</p>}
          {history && history.map((h) => (
            <details key={h.id}>
              <summary><b>{h.card}{h.reversed ? " (reversed)" : ""}</b><span>{new Date(h.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {h.question}</span></summary>
              {(h.text || "This reading was not finished.").split(/\n+/).map((p, i) => <Para key={i} text={p} />)}
            </details>
          ))}
          <button className="linkbtn" onClick={() => setModal(null)}>Close</button>
        </div></div>
      )}

      {modal === "admin" && admin && (
        <div className="adminpanel">
          <h4>ADMIN TEST TOOLS</h4>
          <label>Card you will draw
            <select value={force.index} onChange={(e) => setForce({ ...force, index: e.target.value })}>
              <option value="">Random (as users see it)</option>
              {DECK.map((c) => <option key={c.index} value={c.index}>{c.num} · {c.name}</option>)}
            </select>
          </label>
          <label>Orientation
            <select value={force.orient} onChange={(e) => setForce({ ...force, orient: e.target.value })}><option value="">Random</option><option value="up">Upright</option><option value="rev">Reversed</option></select>
          </label>
          <label>Breathing and cut
            <select value={force.ritual} onChange={(e) => setForce({ ...force, ritual: e.target.value })}><option value="on">Play it</option><option value="off">Skip it</option></select>
          </label>
          <p className="fine">Signed in as {me.email}. Admin readings are free.</p>
          <button onClick={() => setModal(null)}>Close</button>
        </div>
      )}

      <footer className="legal"><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/refunds">Refunds</a><a href="/contact">Contact</a></footer>
    </>
  );
}
