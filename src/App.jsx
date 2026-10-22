import { useEffect, useRef, useState } from "react";
import skull from "./skull.png";
import facade from "./facade.webp";
import doorL from "./door-l.webp";
import doorR from "./door-r.webp";
import "./App.css";

const NAMES = ["ef", "efdanko", "efdiablo"]; // accepted answers (case-insensitive)

/* ---------- synthesized sound effects (no audio files needed) ---------- */
function makeSound() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createGain();
  master.connect(ctx.destination);
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const env = (g, vol, dur, rise = 0.02) => {
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + rise);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  };
  const noise = (type, freq, vol, dur, loop) => {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = buf; s.loop = !!loop; f.type = type; f.frequency.value = freq;
    s.connect(f); f.connect(g); g.connect(master);
    if (loop) { g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 2); }
    else env(g, vol, dur, 0.05);
    s.start();
  };
  const tone = (type, f1, f2, vol, dur, bp) => {
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
    o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    let n = o;
    if (bp) { const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = bp; o.connect(f); n = f; }
    n.connect(g); g.connect(master); env(g, vol, dur); o.start(); o.stop(t + dur + 0.1);
  };
  return {
    wind: () => noise("lowpass", 380, 0.35, 0, true),
    thunder: () => noise("lowpass", 160, 1.2, 3),
    creak: () => { tone("sawtooth", 140, 60, 0.18, 2.4, 450); tone("sawtooth", 95, 45, 0.12, 2.4, 300); },
    boom: () => tone("sine", 80, 30, 1, 1.4),
    beat: () => { tone("sine", 62, 40, 0.9, 0.25); setTimeout(() => tone("sine", 55, 35, 0.7, 0.25), 170); },
    caw: () => { tone("sawtooth", 800 + Math.random() * 400, 380, 0.14, 0.28, 1300); noise("bandpass", 1600, 0.1, 0.15); },
    silence: () => master.gain.setValueAtTime(0, ctx.currentTime),
    mute: (on) => master.gain.setValueAtTime(on ? 0 : 1, ctx.currentTime),
    hum: () => noise("lowpass", 300, 0.1, 0, true),
    flip: () => tone("triangle", 420, 260, 0.12, 0.12),
    match: () => { tone("sine", 520, 820, 0.18, 0.35); setTimeout(() => tone("sine", 780, 1040, 0.12, 0.3), 120); },
    scream: () => { tone("sawtooth", 900, 300, 0.5, 0.9, 1200); tone("square", 400, 1200, 0.25, 0.5, 800); noise("bandpass", 2000, 0.5, 0.7); },
    miss: () => tone("sawtooth", 170, 80, 0.1, 0.3, 300),
    win: () => [440, 554, 659, 880].forEach((f, i) => setTimeout(() => tone("sine", f, f, 0.18, 0.6), i * 160)),
  };
}

/* ---------- games ---------- */
const ICONS = ["💀", "👻", "🎃", "🦇", "🕷️", "🕯️", "🧛", "🪦"];
const shuffle = (a) => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [r[i], r[k]] = [r[k], r[i]]; }
  return r;
};
const deal = () => shuffle([...ICONS, ...ICONS]);

function Memory({ sound, onBack, onWin, onNext }) {
  const [cards, setCards] = useState(deal);
  const [open, setOpen] = useState([]); // face-up cards not yet matched (max 2)
  const [done, setDone] = useState([]); // matched cards
  const [moves, setMoves] = useState(0);
  const [secs, setSecs] = useState(0);
  const [running, setRunning] = useState(false);
  const [best, setBest] = useState(() => { try { return +localStorage.getItem("memBest") || 0; } catch { return 0; } });
  const won = done.length === cards.length;

  useEffect(() => {
    if (!running || won) return;
    const iv = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [running, won]);

  useEffect(() => {
    if (!won) return;
    sound.win();
    onWin();
    if (!best || moves < best) { setBest(moves); try { localStorage.setItem("memBest", moves); } catch {} }
  }, [won]);

  const flip = (i) => {
    if (open.length === 2 || open.includes(i) || done.includes(i)) return;
    sound.flip();
    setRunning(true);
    const next = [...open, i];
    setOpen(next);
    if (next.length < 2) return;
    setMoves((m) => m + 1);
    if (cards[next[0]] === cards[next[1]]) {
      setTimeout(() => { setDone((d) => [...d, ...next]); setOpen([]); sound.match(); }, 450);
    } else {
      setTimeout(() => { setOpen([]); sound.miss(); }, 900);
    }
  };
  const again = () => { setCards(deal()); setOpen([]); setDone([]); setMoves(0); setSecs(0); setRunning(false); };

  return (
    <>
      <h1>Crypt Memory</h1>
      <div className="mbar">
        <span>Moves: {moves}</span><span>Time: {secs}s</span><span>Best: {best || "–"}</span>
      </div>
      <div className="mgrid">
        {cards.map((icon, i) => {
          const up = open.includes(i) || done.includes(i);
          return (
            <button key={i} className={`mcard ${up ? "up" : ""} ${done.includes(i) ? "done" : ""}`} onClick={() => flip(i)}>
              <div className="mface"><div className="mback">✦</div><div className="mfront">{icon}</div></div>
            </button>
          );
        })}
      </div>
      <div className="mbtns"><button onClick={onBack}>Back</button><button onClick={again}>Restart</button></div>
      {won && (
        <Panel title="You survived…" text={`${moves} moves in ${secs} seconds`}>
          <button onClick={again}>Play again</button>
          {onNext && <button onClick={onNext}>Next game →</button>}
          <button onClick={onBack}>Menu</button>
        </Panel>
      )}
    </>
  );
}

function Panel({ title, text, children }) {
  return (
    <div className="win">
      <h1>{title}</h1>
      <p>{text}</p>
      <div className="mbtns">{children}</div>
    </div>
  );
}

/* Game 2: Whack-a-Ghost */
function Whack({ sound, onBack, onWin, onNext }) {
  const GOAL = 15, TIME = 30;
  const [holes, setHoles] = useState(Array(9).fill(null));
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(TIME);
  const [state, setState] = useState("ready"); // ready | play | won | lost
  const [bad, setBad] = useState(false);
  const hr = useRef(Array(9).fill(null));
  const put = (a) => { hr.current = a; setHoles(a); };

  useEffect(() => {
    if (state !== "play") return;
    const tick = setInterval(() => setLeft((l) => l - 1), 1000);
    const spawn = setInterval(() => {
      const free = hr.current.map((v, i) => (v ? null : i)).filter((v) => v !== null);
      if (!free.length) return;
      const i = free[Math.floor(Math.random() * free.length)];
      const c = { type: Math.random() < 0.2 ? "trap" : "ghost", k: Math.random() };
      const a = [...hr.current]; a[i] = c; put(a);
      setTimeout(() => { if (hr.current[i] && hr.current[i].k === c.k) { const b = [...hr.current]; b[i] = null; put(b); } }, 850);
    }, 650);
    return () => { clearInterval(tick); clearInterval(spawn); };
  }, [state]);

  useEffect(() => {
    if (state !== "play") return;
    if (score >= GOAL) { setState("won"); sound.win(); onWin(); }
    else if (left <= 0) setState("lost");
  }, [score, left]);

  const start = () => { put(Array(9).fill(null)); setScore(0); setLeft(TIME); setState("play"); };
  const hit = (i) => {
    const c = hr.current[i];
    if (!c || state !== "play") return;
    const a = [...hr.current]; a[i] = null; put(a);
    if (c.type === "ghost") { setScore((s) => s + 1); sound.flip(); }
    else { setScore((s) => Math.max(0, s - 2)); sound.miss(); setBad(true); setTimeout(() => setBad(false), 250); }
  };

  return (
    <>
      <h1>Whack-a-Ghost</h1>
      <div className="mbar"><span>Ghosts: {score}/{GOAL}</span><span>Time: {Math.max(left, 0)}s</span></div>
      <div className={`wgrid ${bad ? "bad" : ""}`}>
        {holes.map((c, i) => (
          <button key={i} className="hole" onPointerDown={() => hit(i)}>
            <span className="grave">🪦</span>
            {c && <span className={`pop ${c.type}`}>{c.type === "ghost" ? "👻" : "💀"}</span>}
          </button>
        ))}
      </div>
      <div className="mbtns"><button onClick={onBack}>Menu</button></div>
      {state === "ready" && <Panel title="Whack-a-Ghost" text={`Scare away ${GOAL} ghosts in ${TIME} seconds. Never touch the skulls!`}><button onClick={start}>Start</button><button onClick={onBack}>Menu</button></Panel>}
      {state === "lost" && <Panel title="The ghosts won…" text={`You scared ${score} of ${GOAL}.`}><button onClick={start}>Try again</button><button onClick={onBack}>Menu</button></Panel>}
      {state === "won" && <Panel title="They fled in terror!" text={`${GOAL} ghosts scared away.`}><button onClick={start}>Play again</button>{onNext && <button onClick={onNext}>Next game →</button>}<button onClick={onBack}>Menu</button></Panel>}
    </>
  );
}

/* Game 3: Trick or Treat Doors */
const deal3 = () => shuffle(["candy", "empty", "trick"]);
function Doors({ sound, onBack, onWin, onNext }) {
  const GOAL = 3;
  const [round, setRound] = useState(deal3);
  const [picked, setPicked] = useState(null);
  const [candy, setCandy] = useState(0);
  const [lives, setLives] = useState(3);
  const [scare, setScare] = useState(false);
  const [state, setState] = useState("play"); // play | won | lost
  const reset = () => { setRound(deal3()); setPicked(null); setCandy(0); setLives(3); setState("play"); };

  const pick = (i) => {
    if (picked !== null || state !== "play") return;
    const t = round[i], nc = candy + (t === "candy" ? 1 : 0), nl = lives - (t === "trick" ? 1 : 0);
    setPicked(i); sound.creak();
    if (t === "candy") setTimeout(sound.match, 700);
    if (t === "empty") setTimeout(sound.miss, 700);
    if (t === "trick") setTimeout(() => { setScare(true); sound.scream(); sound.boom(); setTimeout(() => setScare(false), 1300); }, 700);
    setCandy(nc); setLives(nl);
    setTimeout(() => {
      if (nc >= GOAL) { setState("won"); sound.win(); onWin(); }
      else if (nl <= 0) setState("lost");
      else { setRound(deal3()); setPicked(null); }
    }, t === "trick" ? 2600 : 2000);
  };
  const msg = picked === null ? "Choose a door…" : { candy: "Candy! 🍬", empty: "Nothing but cobwebs…", trick: "TRICK!" }[round[picked]];

  return (
    <>
      <h1>Trick or Treat</h1>
      <div className="mbar"><span>Candy: {candy}/{GOAL} 🍬</span><span>Candles: {"🕯️".repeat(Math.max(lives, 0))}</span></div>
      <div className="drow">
        {round.map((t, i) => (
          <button key={i} className={`dgate ${picked === i ? "open" : ""} ${picked !== null && picked !== i ? "dim" : ""}`} onClick={() => pick(i)}>
            <div className={`behind b-${t}`}>{{ candy: "🍬", empty: "🕸️", trick: "💀" }[t]}</div>
            <div className="hh hl" style={{ backgroundImage: `url(${doorL})` }} />
            <div className="hh hr" style={{ backgroundImage: `url(${doorR})` }} />
          </button>
        ))}
      </div>
      <p className="msg2">{msg}</p>
      <div className="mbtns"><button onClick={onBack}>Menu</button></div>
      {scare && (
        <div className="scare">
          <div className="skull stare">
            <img src={skull} alt="" />
            <div className="eye" style={{ left: "31.6%", top: "47.8%" }} /><div className="eye" style={{ left: "69.7%", top: "47.8%" }} />
          </div>
        </div>
      )}
      {state === "lost" && <Panel title="The doors slam shut…" text={`You found ${candy} of ${GOAL} candies.`}><button onClick={reset}>Try again</button><button onClick={onBack}>Menu</button></Panel>}
      {state === "won" && <Panel title="Sweet survival!" text="You collected all the candy." ><button onClick={reset}>Play again</button>{onNext && <button onClick={onNext}>Next game →</button>}<button onClick={onBack}>Menu</button></Panel>}
    </>
  );
}

/* Game 4: Flashlight Hunt */
const ITEMS = [["🗝️", "key"], ["🕯️", "candle"], ["🦇", "bat"], ["💀", "skull"], ["🪙", "coin"]];
const place = () => {
  const out = [];
  for (const [e, n] of ITEMS) {
    let p, tries = 0;
    do { p = { e, n, x: 8 + Math.random() * 84, y: 18 + Math.random() * 74 }; tries++; }
    while (tries < 30 && out.some((o) => Math.hypot(o.x - p.x, (o.y - p.y) * 0.6) < 16));
    out.push(p);
  }
  return out;
};
function Hunt({ sound, onBack, onWin, onNext }) {
  const [items, setItems] = useState(place);
  const [found, setFound] = useState([]);
  const [pos, setPos] = useState({ x: innerWidth / 2, y: innerHeight / 2 });
  const [r, setR] = useState(120);
  const won = found.length === ITEMS.length;

  useEffect(() => {
    const iv = setInterval(() => setR(Math.random() < 0.1 ? 75 : 120 + Math.random() * 12), 130);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => { if (won) { sound.win(); onWin(); } }, [won]);

  const move = (e) => setPos({ x: e.clientX, y: e.clientY });
  const grab = (n) => { sound.match(); setFound((f) => (f.includes(n) ? f : [...f, n])); };
  const again = () => { setItems(place()); setFound([]); };

  return (
    <div className="hunt" style={{ backgroundImage: `url(${facade})` }} onPointerMove={move} onPointerDown={move}>
      {items.filter((i) => !found.includes(i.n)).map((i) => (
        <button key={i.n} className="hitem" style={{ left: i.x + "%", top: i.y + "%" }} onClick={() => grab(i.n)}>{i.e}</button>
      ))}
      <div className="ghost2">👻</div>
      <div className="dark" style={{ background: `radial-gradient(circle ${r * 0.9}px at ${pos.x}px ${pos.y}px, rgba(127,184,230,.14), transparent 70%), radial-gradient(circle ${r}px at ${pos.x}px ${pos.y}px, transparent 0%, transparent 30%, rgba(0,0,0,.985) 100%)` }} />
      <div className="hud"><button onClick={onBack}>Menu</button><span>{ITEMS.map(([e, n]) => (found.includes(n) ? e : "❔")).join(" ")}</span></div>
      <p className="hint">Move your light. Click what you find.</p>
      {won && <Panel title="You found them all!" text="The darkness lets you go…"><button onClick={again}>Play again</button>{onNext && <button onClick={onNext}>Next game →</button>}<button onClick={onBack}>Menu</button></Panel>}
    </div>
  );
}

/* Games hub: each game unlocks after the previous one is completed */
const GAMES = [
  { id: "memory", name: "Crypt Memory", icon: "🕯️", C: Memory },
  { id: "whack", name: "Whack-a-Ghost", icon: "👻", C: Whack },
  { id: "doors", name: "Trick or Treat", icon: "🚪", C: Doors },
  { id: "hunt", name: "Flashlight Hunt", icon: "🔦", C: Hunt },
];
function Games({ sound }) {
  const [view, setView] = useState(null);
  const [muted, setMuted] = useState(false);
  const [done, setDone] = useState(() => { try { return JSON.parse(localStorage.getItem("spookyDone")) || []; } catch { return []; } });
  useEffect(() => { sound.mute(false); sound.hum(); }, []);
  const toggle = () => { sound.mute(!muted); setMuted(!muted); };
  const save = (n) => { try { localStorage.setItem("spookyDone", JSON.stringify(n)); } catch {} };
  const win = (id) => setDone((d) => { if (d.includes(id)) return d; const n = [...d, id]; save(n); return n; });
  const reset = () => { setDone([]); save([]); };
  const idx = GAMES.findIndex((g) => g.id === view);
  const G = GAMES[idx];
  const next = GAMES[idx + 1];
  const all = done.length >= GAMES.length;
  return (
    <div className="games">
      <button className="mute" onClick={toggle}>{muted ? "🔇" : "🔊"}</button>
      {G ? (
        <G.C key={view} sound={sound} onBack={() => setView(null)} onWin={() => win(G.id)} onNext={next ? () => setView(next.id) : null} />
      ) : (
        <>
          <h1>{all ? "You survived every trial…" : "Choose your fate"}</h1>
          {all && <p className="msg2">Happy Halloween! 🎃</p>}
          <div className="cards">
            {GAMES.map((g, i) => {
              const open = i === 0 || done.includes(GAMES[i - 1].id);
              return open ? (
                <button key={g.id} className={`gcard ${done.includes(g.id) ? "cleared" : ""}`} onClick={() => setView(g.id)}><span>{g.icon}</span>{g.name}{done.includes(g.id) && <small>cleared ✓</small>}</button>
              ) : (
                <div key={g.id} className="gcard locked"><span>🔒</span>Locked</div>
              );
            })}
          </div>
          <button className="link" onClick={reset}>reset progress</button>
        </>
      )}
    </div>
  );
}

/* ---------- palace gate animation ---------- */
const SCALE = [1, 1.3, 1.4, 10, 10, 10, 10];
const DUR = ["0s", "2s", "2s", "3s", "0s", "0s", "0s"];

function Gate({ sound }) {
  const [phase, setPhase] = useState(0);
  const [flash, setFlash] = useState(false);
  const cv = useRef(null);

  useEffect(() => {
    const T = [];
    const at = (ms, fn) => T.push(setTimeout(fn, ms));
    sound.wind();
    [1800, 2700, 3600, 4500, 5300, 6000, 6600, 7200, 7700, 8200, 8600, 9000, 9400, 9800, 10200, 10600, 11000].forEach((m) => at(m, sound.beat));
    at(1500, () => { setPhase(1); setFlash(true); sound.thunder(); });
    at(1650, () => setFlash(false));
    at(3500, () => { setPhase(2); sound.creak(); });
    at(5700, sound.boom);
    at(6000, () => setPhase(3));
    at(8800, () => { setFlash(true); sound.thunder(); });
    at(8950, () => setFlash(false));
    at(9000, () => {
      setPhase(4);
      const iv = setInterval(sound.caw, 110);
      T.push(setTimeout(() => clearInterval(iv), 2500));
    });
    at(11500, () => { setPhase(5); sound.silence(); });
    at(13000, () => setPhase(6));
    return () => T.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (phase !== 4) return;
    const c = cv.current, x = c.getContext("2d");
    c.width = innerWidth; c.height = innerHeight;
    const cx = c.width / 2, cy = c.height * 0.55, R = Math.hypot(c.width, c.height) * 0.7;
    const t0 = performance.now();
    const mk = (now) => ({ a: Math.random() * 6.283, s: now + Math.random() * 1500, life: 1300 + Math.random() * 600, k: Math.random() * 6 });
    const birds = Array.from({ length: 280 }, () => mk(t0));
    let raf;
    const draw = (now) => {
      x.clearRect(0, 0, c.width, c.height);
      x.fillStyle = "#000";
      for (const b of birds) {
        let t = (now - b.s) / b.life;
        if (t > 1 && now - t0 < 1900) { Object.assign(b, mk(now)); t = 0; }
        if (t < 0 || t > 1) continue;
        const e = t * t, px = cx + Math.cos(b.a) * e * R, py = cy + Math.sin(b.a) * e * R * 0.8;
        const sc = 0.08 + e * 4.5, fl = Math.sin(now * 0.03 + b.k) * 14;
        x.save(); x.translate(px, py); x.scale(sc, sc); x.beginPath();
        x.moveTo(0, 0);
        x.quadraticCurveTo(-18, -12 - fl, -42, 2 - fl); x.quadraticCurveTo(-20, -2, 0, 8);
        x.quadraticCurveTo(20, -2, 42, 2 - fl); x.quadraticCurveTo(18, -12 - fl, 0, 0);
        x.fill(); x.restore();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  return (
    <div className="gate">
      <div className="stage">
        <div className={`zoom ${phase >= 2 ? "open" : ""}`} style={{ transform: `scale(${SCALE[phase]})`, transitionDuration: DUR[phase] }}>
          <div className="interior" />
          <div className="doors">
            <div className="door l" style={{ backgroundImage: `url(${doorL})` }} />
            <div className="door r" style={{ backgroundImage: `url(${doorR})` }} />
          </div>
          <img className="facade" src={facade} alt="" draggable="false" />
          <div className="spill" />
          <div className="fog f1" /><div className="fog f2" />
        </div>
      </div>
      <canvas ref={cv} className="crows" />
      <div className={`flash ${flash ? "on" : ""}`} />
      <div className="vignette" />
      <div className={`black ${phase >= 5 ? "on" : ""}`} />
      {phase >= 6 && <Games sound={sound} />}
    </div>
  );
}

/* ---------- login page ---------- */
function Login({ onEnter }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [focus, setFocus] = useState(false);
  const [name, setName] = useState("");
  const [err, setErr] = useState(false);
  const [out, setOut] = useState(false);

  useEffect(() => {
    const mv = (e) => setPos({ x: (e.clientX / innerWidth - 0.5) * 2, y: (e.clientY / innerHeight - 0.5) * 2 });
    addEventListener("pointermove", mv);
    return () => removeEventListener("pointermove", mv);
  }, []);

  const look = focus ? { x: 0, y: 0 } : pos; // focused = stares straight at you
  const submit = (e) => {
    e.preventDefault();
    if (NAMES.includes(name.trim().toLowerCase())) {
      const sound = makeSound(); // created inside the click = audio allowed
      setOut(true);
      setTimeout(() => onEnter(sound), 900);
    } else {
      setErr(true);
      setTimeout(() => setErr(false), 700);
    }
  };
  const eye = (left) => (
    <div className="eye" style={{ left, top: "47.8%", transform: `translate(${look.x * 7}px, ${look.y * 5}px)` }} />
  );

  return (
    <form className={`login ${out ? "out" : ""} ${err ? "shake" : ""}`} onSubmit={submit}>
      <div className={`skull ${focus ? "stare" : ""} ${err ? "angry" : ""}`}
        style={{ transform: `perspective(700px) rotateY(${look.x * 28}deg) rotateX(${-look.y * 22}deg) scale(${focus ? 1.08 : 1})` }}>
        <img src={skull} alt="" draggable="false" />
        {eye("31.6%")}{eye("69.7%")}
      </div>
      <h1>Who goes there?</h1>
      <input value={name} onChange={(e) => setName(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        placeholder="Name of the first friend…" autoComplete="off" spellCheck="false" />
      <button type="submit">Enter</button>
      <p className="msg">{err ? "The dead do not know that name…" : "\u00A0"}</p>
    </form>
  );
}

export default function App() {
  const [sound, setSound] = useState(null);
  return sound ? <Gate sound={sound} /> : <Login onEnter={setSound} />;
}
