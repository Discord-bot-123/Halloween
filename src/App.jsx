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
    shot: () => noise("bandpass", 1200, 0.25, 0.1),
    wail: () => { tone("sine", 620, 260, 0.2, 0.45); tone("triangle", 940, 400, 0.08, 0.4); },
    miss: () => tone("sawtooth", 170, 80, 0.1, 0.3, 300),
    win: () => [440, 554, 659, 880].forEach((f, i) => setTimeout(() => tone("sine", f, f, 0.18, 0.6), i * 160)),
  };
}

/* ---------- atmosphere: extra spooky effects for the login + games menu ---------- */
function Trail() { // blue ember trail that follows the cursor
  const cv = useRef(null);
  useEffect(() => {
    const c = cv.current, x = c.getContext("2d");
    let ps = [], raf, last = performance.now();
    const size = () => { c.width = innerWidth; c.height = innerHeight; };
    size();
    const mv = (e) => {
      for (let i = 0; i < 2; i++) ps.push({ x: e.clientX, y: e.clientY, vx: (Math.random() - 0.5) * 40, vy: -20 - Math.random() * 50, life: 1, r: 3 + Math.random() * 5 });
      if (ps.length > 120) ps.splice(0, ps.length - 120);
    };
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      x.clearRect(0, 0, c.width, c.height); x.globalCompositeOperation = "lighter";
      ps = ps.filter((p) => p.life > 0);
      for (const p of ps) {
        p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 1.4;
        const a = Math.max(p.life, 0), g = x.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.5);
        g.addColorStop(0, `rgba(234,248,255,${a})`); g.addColorStop(0.4, `rgba(63,167,255,${a * 0.6})`); g.addColorStop(1, "rgba(31,95,224,0)");
        x.fillStyle = g; x.beginPath(); x.arc(p.x, p.y, p.r * 2.5, 0, 6.283); x.fill();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    addEventListener("pointermove", mv); addEventListener("resize", size);
    return () => { cancelAnimationFrame(raf); removeEventListener("pointermove", mv); removeEventListener("resize", size); };
  }, []);
  return <canvas ref={cv} className="trail" />;
}

function Bats() { // a bat swoops across the screen every 7-13 seconds
  const [bats, setBats] = useState([]);
  useEffect(() => {
    let t;
    const go = () => {
      const b = { id: Math.random(), y: 8 + Math.random() * 55, dir: Math.random() < 0.5, dur: 4 + Math.random() * 3 };
      setBats((l) => [...l, b]);
      setTimeout(() => setBats((l) => l.filter((o) => o.id !== b.id)), b.dur * 1000 + 200);
      t = setTimeout(go, 7000 + Math.random() * 6000);
    };
    t = setTimeout(go, 2500);
    return () => clearTimeout(t);
  }, []);
  return bats.map((b) => <span key={b.id} className={`bat ${b.dir ? "ltr" : "rtl"}`} style={{ top: b.y + "%", animationDuration: b.dur + "s" }}>🦇</span>);
}

function Lightning({ sound }) { // random double flash of lightning, with distant thunder when sound is on
  const [on, setOn] = useState(false);
  useEffect(() => {
    let t;
    const go = () => {
      setOn(true); setTimeout(() => setOn(false), 90); setTimeout(() => setOn(true), 170); setTimeout(() => setOn(false), 330);
      if (sound) setTimeout(() => sound.thunder(), 500 + Math.random() * 900);
      t = setTimeout(go, 12000 + Math.random() * 14000);
    };
    t = setTimeout(go, 6000 + Math.random() * 6000);
    return () => clearTimeout(t);
  }, []);
  return <div className={`lflash ${on ? "on" : ""}`} />;
}

const Cobweb = ({ flip }) => (
  <svg className={`web ${flip ? "flip" : ""}`} viewBox="0 0 120 120">
    <g fill="none" stroke="#9fb6cf" strokeWidth=".8" opacity=".5">
      <path d="M0 0L120 0M0 0L110 45M0 0L85 85M0 0L45 110M0 0L0 120" />
      <path d="M30 0Q26 26 0 30M60 0Q52 52 0 60M90 0Q78 78 0 90M118 0Q104 104 0 118" />
    </g>
  </svg>
);
const Torch = ({ side }) => (
  <div className={`torch ${side}`}><div className="tglow" /><div className="tflame" /><div className="tstick" /></div>
);

function Atmosphere({ sound }) {
  return (
    <>
      <div className="atmo">
        <div className="mist"><i /><i /></div>
        <Cobweb /><Cobweb flip />
        <Torch side="l" /><Torch side="r" />
        {[["6%", "28%"], ["84%", "60%"], ["14%", "80%"]].map(([l, t], i) => (
          <div key={i} className="watch" style={{ left: l, top: t, animationDelay: `${i * 3.7}s` }}><i /><i /></div>
        ))}
      </div>
      <Bats /><Lightning sound={sound} /><div className="vig" /><Trail />
    </>
  );
}

/* ---------- games ---------- */
const ICONS = ["💀", "👻", "🎃", "🦇", "🕷️", "🕯️", "🧛", "🪦"];
const shuffle = (a) => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [r[i], r[k]] = [r[k], r[i]]; }
  return r;
};
const deal = () => shuffle([...ICONS, ...ICONS]);

function Memory({ sound, onBack, onWin, onNext, nextLabel }) {
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
          {onNext && <button onClick={onNext}>{nextLabel}</button>}
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
function Whack({ sound, onBack, onWin, onNext, nextLabel }) {
  const GOAL = 15, TIME = 30, PEN = 3; // PEN = seconds lost for hitting a skull
  const [holes, setHoles] = useState(Array(9).fill(null));
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(TIME);
  const [state, setState] = useState("ready"); // ready | play | won | lost
  const [bad, setBad] = useState(false);
  const [pen, setPen] = useState(false);
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
    else { setScore((s) => Math.max(0, s - 2)); setLeft((l) => l - PEN); sound.miss(); setBad(true); setTimeout(() => setBad(false), 250); setPen(true); setTimeout(() => setPen(false), 900); }
  };

  return (
    <>
      <h1>Whack-a-Ghost</h1>
      <div className="mbar"><span>Ghosts: {score}/{GOAL}</span><span className={pen ? "pen" : ""}>Time: {Math.max(left, 0)}s{pen ? ` (-${PEN}s)` : ""}</span></div>
      <div className={`wgrid ${bad ? "bad" : ""}`}>
        {holes.map((c, i) => (
          <button key={i} className="hole" onPointerDown={() => hit(i)}>
            <span className="grave">🪦</span>
            {c && <span className={`pop ${c.type}`}>{c.type === "ghost" ? "👻" : "💀"}</span>}
          </button>
        ))}
      </div>
      <div className="mbtns"><button onClick={onBack}>Menu</button></div>
      {state === "ready" && <Panel title="Whack-a-Ghost" text={`Scare away ${GOAL} ghosts in ${TIME} seconds. Hitting a skull costs ${PEN} seconds and 2 points!`}><button onClick={start}>Start</button><button onClick={onBack}>Menu</button></Panel>}
      {state === "lost" && <Panel title="The ghosts won…" text={`You scared ${score} of ${GOAL}.`}><button onClick={start}>Try again</button><button onClick={onBack}>Menu</button></Panel>}
      {state === "won" && <Panel title="They fled in terror!" text={`${GOAL} ghosts scared away.`}><button onClick={start}>Play again</button>{onNext && <button onClick={onNext}>{nextLabel}</button>}<button onClick={onBack}>Menu</button></Panel>}
    </>
  );
}

/* Game 3: Trick or Treat Doors */
const deal3 = () => shuffle(["candy", "empty", "trick"]);
function Doors({ sound, onBack, onWin, onNext, nextLabel }) {
  const GOAL = 3;
  const [round, setRound] = useState(deal3);
  const [picked, setPicked] = useState(null);
  const [candy, setCandy] = useState(0);
  const [lives, setLives] = useState(3);
  const [scare, setScare] = useState(false);
  const [state, setState] = useState("play"); // play | won | lost
  const [busy, setBusy] = useState(false); // true while the doors are closing
  const reset = () => { setRound(deal3()); setPicked(null); setBusy(false); setCandy(0); setLives(3); setState("play"); };

  const pick = (i) => {
    if (picked !== null || busy || state !== "play") return;
    const t = round[i], nc = candy + (t === "candy" ? 1 : 0), nl = lives - (t === "trick" ? 1 : 0);
    setPicked(i); sound.creak();
    if (t === "candy") setTimeout(sound.match, 700);
    if (t === "empty") setTimeout(sound.miss, 700);
    if (t === "trick") setTimeout(() => { setScare(true); sound.scream(); sound.boom(); setTimeout(() => setScare(false), 1300); }, 700);
    setCandy(nc); setLives(nl);
    setTimeout(() => {
      if (nc >= GOAL) { setState("won"); sound.win(); onWin(); }
      else if (nl <= 0) setState("lost");
      else { setPicked(null); setBusy(true); setTimeout(() => { setRound(deal3()); setBusy(false); }, 1400); } // close first, re-deal only once the doors are shut
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
      {state === "won" && <Panel title="Sweet survival!" text="You collected all the candy." ><button onClick={reset}>Play again</button>{onNext && <button onClick={onNext}>{nextLabel}</button>}<button onClick={onBack}>Menu</button></Panel>}
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
function Hunt({ sound, onBack, onWin, onNext, nextLabel }) {
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
      {won && <Panel title="You found them all!" text="The darkness lets you go…"><button onClick={again}>Play again</button>{onNext && <button onClick={onNext}>{nextLabel}</button>}<button onClick={onBack}>Menu</button></Panel>}
    </div>
  );
}

/* Game 5: Haunted Maze */
const MW = 21, MH = 21, TILE = 24;
const makeMaze = () => {
  const g = Array.from({ length: MH }, () => Array(MW).fill(1));
  const sx = 1 + 2 * Math.floor(Math.random() * ((MW - 1) / 2)), sy = 1 + 2 * Math.floor(Math.random() * ((MH - 1) / 2));
  const stack = [[sx, sy]]; g[sy][sx] = 0;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const nb = shuffle([[2, 0], [-2, 0], [0, 2], [0, -2]]).map(([a, b]) => [x + a, y + b, a, b])
      .filter(([nx, ny]) => nx > 0 && ny > 0 && nx < MW - 1 && ny < MH - 1 && g[ny][nx] === 1);
    if (!nb.length) { stack.pop(); continue; }
    const [nx, ny, a, b] = nb[0];
    g[y + b / 2][x + a / 2] = 0; g[ny][nx] = 0; stack.push([nx, ny]);
  }
  for (let k = 0; k < 14; k++) { // a few extra gaps so the maze has loops
    const x = 1 + Math.floor(Math.random() * (MW - 2)), y = 1 + Math.floor(Math.random() * (MH - 2));
    if (g[y][x] === 1 && ((g[y][x - 1] === 0 && g[y][x + 1] === 0) || (g[y - 1][x] === 0 && g[y + 1][x] === 0))) g[y][x] = 0;
  }
  // exit = one of the cells farthest from the start (BFS order, so the last ones are the farthest)
  const seen = Array.from({ length: MH }, () => Array(MW).fill(false)); seen[sy][sx] = true;
  const q = [[sx, sy]];
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + a, ny = y + b;
      if (g[ny] && g[ny][nx] === 0 && !seen[ny][nx]) { seen[ny][nx] = true; q.push([nx, ny]); }
    }
  }
  const far = q.slice(-Math.max(6, Math.floor(q.length * 0.06)));
  const [ex, ey] = far[Math.floor(Math.random() * far.length)];
  return { grid: g, start: { x: sx, y: sy }, exit: { x: ex, y: ey } };
};
const glow = (x, cx, cy, rad, rgb, a) => {
  const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
};

function Maze({ sound, onBack, onWin, onNext, nextLabel }) {
  const cv = useRef(null);
  const G = useRef(null);
  const [state, setState] = useState("ready"); // ready | play | won
  const [caught, setCaught] = useState(0);

  const start = () => {
    const { grid, start: st, exit } = makeMaze(), far = [];
    grid.forEach((row, y) => row.forEach((v, x) => { if (!v && Math.hypot(x - st.x, y - st.y) > 10) far.push([x, y]); }));
    const ghosts = shuffle(far).slice(0, 3).map(([x, y]) => ({ x, y, dx: 0, dy: 0 }));
    G.current = { grid, start: st, exit, p: { ...st }, ghosts, dir: null, t0: performance.now(), flash: 0 };
    setCaught(0); setState("play");
  };
  const setDir = (d) => { if (G.current) G.current.dir = d; };

  useEffect(() => {
    if (state !== "play") return;
    const g = G.current, c = cv.current, x = c.getContext("2d");
    const dk = document.createElement("canvas"); dk.width = dk.height = MW * TILE;
    const dx = dk.getContext("2d");
    const free = (a, b) => g.grid[b] && g.grid[b][a] === 0;
    const check = () => {
      if (g.ghosts.some((h) => h.x === g.p.x && h.y === g.p.y)) {
        sound.scream(); g.flash = 1; g.p = { ...g.start }; g.t0 = performance.now(); setCaught((n) => n + 1);
      }
    };
    const walk = setInterval(() => {
      if (!g.dir) return;
      const nx = g.p.x + g.dir[0], ny = g.p.y + g.dir[1];
      if (!free(nx, ny)) return;
      g.p = { x: nx, y: ny };
      if (nx === g.exit.x && ny === g.exit.y) { setState("won"); sound.win(); onWin(); return; }
      check();
    }, 120);
    const haunt = setInterval(() => {
      for (const h of g.ghosts) {
        const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => free(h.x + a, h.y + b));
        const fwd = opts.filter(([a, b]) => !(a === -h.dx && b === -h.dy));
        const pool = fwd.length ? fwd : opts;
        const straight = pool.find(([a, b]) => a === h.dx && b === h.dy);
        const [a, b] = straight && Math.random() < 0.6 ? straight : pool[Math.floor(Math.random() * pool.length)];
        h.x += a; h.y += b; h.dx = a; h.dy = b;
      }
      check();
    }, 380);
    const keys = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] };
    const kd = (e) => { const d = keys[e.key]; if (d) { g.dir = d; e.preventDefault(); } };
    const ku = (e) => { const d = keys[e.key]; if (d && g.dir === d) g.dir = null; };
    addEventListener("keydown", kd); addEventListener("keyup", ku);

    let raf;
    const draw = (now) => {
      const r = Math.max(2.6, 5.2 - (now - g.t0) / 25000) + (Math.random() < 0.08 ? -0.6 : 0); // light shrinks over time
      x.fillStyle = "#05070D"; x.fillRect(0, 0, c.width, c.height);
      for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
        x.fillStyle = g.grid[j][i] ? "#22344f" : "#0d1626"; x.fillRect(i * TILE, j * TILE, TILE, TILE);
        if (g.grid[j][i]) { x.strokeStyle = "#0B1220"; x.strokeRect(i * TILE + 0.5, j * TILE + 0.5, TILE - 1, TILE - 1); }
      }
      const px = (g.p.x + 0.5) * TILE, py = (g.p.y + 0.5) * TILE;
      x.fillStyle = "#C9D6E3"; x.beginPath(); x.arc(px, py, TILE * 0.3, 0, 6.283); x.fill();
      dx.globalCompositeOperation = "source-over"; dx.clearRect(0, 0, dk.width, dk.height);
      dx.fillStyle = "rgba(0,0,0,.985)"; dx.fillRect(0, 0, dk.width, dk.height);
      dx.globalCompositeOperation = "destination-out";
      const gr = dx.createRadialGradient(px, py, TILE * 0.5, px, py, r * TILE);
      gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      dx.fillStyle = gr; dx.fillRect(0, 0, dk.width, dk.height);
      x.drawImage(dk, 0, 0);
      const ex = (g.exit.x + 0.5) * TILE, ey = (g.exit.y + 0.5) * TILE; // exit beacon, always visible
      glow(x, ex, ey, TILE * 1.6, "255,140,66", 0.6 + 0.2 * Math.sin(now / 200));
      x.font = `${TILE * 0.8}px serif`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("🚪", ex, ey);
      for (const h of g.ghosts) { // blue flames, dimly visible even in the dark
        const hx = (h.x + 0.5) * TILE, hy = (h.y + 0.5) * TILE;
        glow(x, hx, hy, TILE * 1.1, "63,167,255", 0.7 + 0.2 * Math.sin(now / 90 + h.x));
        x.fillStyle = "#EAF8FF"; x.beginPath(); x.arc(hx, hy, TILE * 0.14, 0, 6.283); x.fill();
      }
      if (g.flash > 0) { x.fillStyle = `rgba(180,0,0,${g.flash * 0.5})`; x.fillRect(0, 0, c.width, c.height); g.flash -= 0.05; }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { clearInterval(walk); clearInterval(haunt); cancelAnimationFrame(raf); removeEventListener("keydown", kd); removeEventListener("keyup", ku); };
  }, [state]);

  return (
    <>
      <h1>Haunted Maze</h1>
      <div className="mbar"><span>Caught: {caught}</span><span>Reach the glowing door 🚪</span></div>
      <canvas ref={cv} className="mazecv" width={MW * TILE} height={MH * TILE} />
      <div className="dpad">
        {[["▲", [0, -1], "u"], ["◀", [-1, 0], "l"], ["▶", [1, 0], "r"], ["▼", [0, 1], "d"]].map(([t, d, k]) => (
          <button key={k} className={k} onPointerDown={() => setDir(d)} onPointerUp={() => setDir(null)} onPointerLeave={() => setDir(null)}>{t}</button>
        ))}
      </div>
      <div className="mbtns"><button onClick={onBack}>Menu</button></div>
      {state === "ready" && <Panel title="Haunted Maze" text="Find the glowing door with the arrow keys or WASD. Your light shrinks over time. The blue flames send you back to the start."><button onClick={start}>Enter</button><button onClick={onBack}>Menu</button></Panel>}
      {state === "won" && <Panel title="You escaped!" text={caught ? `Caught ${caught} time${caught > 1 ? "s" : ""} on the way.` : "Not a single flame touched you."}><button onClick={start}>Play again</button>{onNext && <button onClick={onNext}>{nextLabel}</button>}<button onClick={onBack}>Menu</button></Panel>}
    </>
  );
}

/* Game 6: Ghost Shooter */
function Ghosts({ sound, onBack, onWin, onNext, nextLabel }) {
  const GOAL = 30, TIME = 40;
  const cv = useRef(null);
  const live = useRef({ crows: [], fx: [] });
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(TIME);
  const [state, setState] = useState("ready"); // ready | play | won | lost

  const start = () => { live.current = { crows: [], fx: [] }; setScore(0); setLeft(TIME); setState("play"); };

  useEffect(() => {
    if (state !== "play") return;
    const L = live.current, x = cv.current.getContext("2d");
    const tick = setInterval(() => setLeft((l) => l - 1), 1000);
    const spawn = () => {
      const small = Math.random() < 0.45, dir = Math.random() < 0.5 ? 1 : -1;
      L.crows.push({ x: dir > 0 ? -50 : 850, y: 60 + Math.random() * 280, vx: dir * (small ? 230 : 130) * (0.8 + Math.random() * 0.4),
        s: small ? 1 : 1.7, pts: small ? 2 : 1, ph: Math.random() * 6, wob: 30 + Math.random() * 50 });
    };
    const sp = setInterval(spawn, 480); spawn();
    let last = performance.now(), raf;
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const sky = x.createLinearGradient(0, 0, 0, 500);
      sky.addColorStop(0, "#05070D"); sky.addColorStop(0.7, "#0B1220"); sky.addColorStop(1, "#1B2A41");
      x.fillStyle = sky; x.fillRect(0, 0, 800, 500);
      glow(x, 660, 90, 120, "200,225,255", 0.5);
      x.fillStyle = "#dbeaff"; x.beginPath(); x.arc(660, 90, 36, 0, 6.283); x.fill();
      x.fillStyle = "#02040a"; x.fillRect(0, 450, 800, 50);
      [[60, 50], [150, 36], [330, 60], [520, 44], [700, 56]].forEach(([px, h]) => { x.fillRect(px, 450 - h, 30, h); x.beginPath(); x.arc(px + 15, 450 - h, 15, Math.PI, 0); x.fill(); });
      for (const cr of L.crows) {
        cr.x += cr.vx * dt; cr.y += Math.sin(now / 400 + cr.ph) * cr.wob * dt;
        const a = 0.72 + 0.25 * Math.sin(now / 250 + cr.ph), s = cr.s, w = Math.sin(now / 160 + cr.ph) * 3;
        x.save(); x.translate(cr.x, cr.y); x.rotate(cr.vx > 0 ? 0.12 : -0.12); x.scale(s, s);
        glow(x, 0, 6, 34, "150,210,255", 0.35 * a);
        x.globalAlpha = a; x.fillStyle = "#DDEEFF"; x.beginPath(); x.arc(0, 0, 18, Math.PI, 0); x.lineTo(18, 26);
        x.quadraticCurveTo(12, 18 + w, 6, 26); x.quadraticCurveTo(0, 18 - w, -6, 26); x.quadraticCurveTo(-12, 18 + w, -18, 26); x.closePath(); x.fill();
        x.fillStyle = "#0B1220";
        x.beginPath(); x.ellipse(-6, -2, 3, 4.5, 0, 0, 6.283); x.fill();
        x.beginPath(); x.ellipse(6, -2, 3, 4.5, 0, 0, 6.283); x.fill();
        x.beginPath(); x.ellipse(0, 9, 3, 4, 0, 0, 6.283); x.fill(); x.restore();
      }
      L.crows = L.crows.filter((cr) => cr.x > -90 && cr.x < 890);
      for (const f of L.fx) { f.x += f.vx * dt; f.y += f.vy * dt; f.vy -= 80 * dt; f.life -= dt * 1.2; x.globalAlpha = Math.max(f.life, 0); x.fillStyle = "#BFE3FF"; x.beginPath(); x.arc(f.x, f.y, 2.5, 0, 6.283); x.fill(); }
      x.globalAlpha = 1; L.fx = L.fx.filter((f) => f.life > 0);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { clearInterval(tick); clearInterval(sp); cancelAnimationFrame(raf); };
  }, [state]);

  useEffect(() => {
    if (state !== "play") return;
    if (score >= GOAL) { setState("won"); sound.win(); onWin(); }
    else if (left <= 0) setState("lost");
  }, [score, left]);

  const shoot = (e) => {
    if (state !== "play") return;
    const r = cv.current.getBoundingClientRect();
    const px = (e.clientX - r.left) * (800 / r.width), py = (e.clientY - r.top) * (500 / r.height);
    const L = live.current;
    const i = L.crows.findIndex((cr) => Math.hypot(cr.x - px, cr.y + 6 * cr.s - py) < 22 * cr.s + 10);
    sound.shot();
    if (i < 0) return;
    const cr = L.crows.splice(i, 1)[0];
    sound.wail();
    for (let k = 0; k < 12; k++) L.fx.push({ x: cr.x, y: cr.y, vx: (Math.random() - 0.5) * 240, vy: (Math.random() - 0.5) * 200, life: 1 });
    setScore((s) => s + cr.pts);
  };

  return (
    <>
      <h1>Ghost Shooter</h1>
      <div className="mbar"><span>Points: {score}/{GOAL}</span><span>Time: {Math.max(left, 0)}s</span></div>
      <canvas ref={cv} className="crowcv" width={800} height={500} onPointerDown={shoot} />
      <div className="mbtns"><button onClick={onBack}>Menu</button></div>
      {state === "ready" && <Panel title="Ghost Shooter" text={`Scare the ghosts before they float away. Small fast ghosts are worth 2 points. Get ${GOAL} points in ${TIME} seconds.`}><button onClick={start}>Start</button><button onClick={onBack}>Menu</button></Panel>}
      {state === "lost" && <Panel title="The ghosts took over…" text={`You scored ${score} of ${GOAL}.`}><button onClick={start}>Try again</button><button onClick={onBack}>Menu</button></Panel>}
      {state === "won" && <Panel title="The night is quiet!" text={`${score} points with ${Math.max(left, 0)} seconds to spare.`}><button onClick={start}>Play again</button>{onNext && <button onClick={onNext}>{nextLabel}</button>}<button onClick={onBack}>Menu</button></Panel>}
    </>
  );
}

/* ---------- final credits ---------- */
const FRIEND = "EFDIABLO"; // name shown in the credits

function Credits({ sound, onBack }) {
  const [ended, setEnded] = useState(false);
  const [k, setK] = useState(0);
  useEffect(() => { sound.win(); }, []);
  const again = () => { setEnded(false); setK((n) => n + 1); sound.win(); };
  return (
    <div className="credits">
      <Atmosphere sound={sound} />
      <div className="roll" key={k} onAnimationEnd={(e) => { if (e.target === e.currentTarget) setEnded(true); }}>
        <h1 className="c-big">Thank you {FRIEND}</h1>
        <p className="c-sub">for clearing all the games.</p>
        <div className="c-gap" />
        <p className="c-sub">Hope you liked all the mini games.</p>
        <div className="c-gap" />
        <p className="c-head">THE TRIALS YOU SURVIVED</p>
        {GAMES.map((g) => <p key={g.id} className="c-item">{g.icon} {g.name}</p>)}
        <div className="c-gap" />
        <p className="c-head">THE END</p>
        <div className="c-gap" />
        <p className="c-sub">Sorry, AI was used to make this. 🤖</p>
      </div>
      {!ended && <button className="skipc" onClick={onBack}>Skip</button>}
      {ended && (
        <div className="theend">
          <h1>Happy Halloween 🎃</h1>
          <p className="c-note">Sorry, AI was used to make this. 🤖</p>
          <div className="mbtns"><button onClick={again}>Watch again</button><button onClick={onBack}>Menu</button></div>
        </div>
      )}
    </div>
  );
}

/* Games hub: each game unlocks after the previous one is completed */
const GAMES = [
  { id: "memory", name: "Crypt Memory", icon: "🕯️", C: Memory },
  { id: "whack", name: "Whack-a-Ghost", icon: "👻", C: Whack },
  { id: "doors", name: "Trick or Treat", icon: "🚪", C: Doors },
  { id: "hunt", name: "Flashlight Hunt", icon: "🔦", C: Hunt },
  { id: "maze", name: "Haunted Maze", icon: "🏚️", C: Maze },
  { id: "crows", name: "Ghost Shooter", icon: "🌫️", C: Ghosts },
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
      {view === "credits" ? (
        <Credits sound={sound} onBack={() => setView(null)} />
      ) : G ? (
        <G.C key={view} sound={sound} onBack={() => setView(null)} onWin={() => win(G.id)}
          onNext={() => setView(next ? next.id : "credits")} nextLabel={next ? "Next game →" : "Roll credits →"} />
      ) : (
        <>
          <Atmosphere sound={sound} />
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
          {all && <button onClick={() => setView("credits")}>Watch credits</button>}
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
      <Atmosphere />
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
