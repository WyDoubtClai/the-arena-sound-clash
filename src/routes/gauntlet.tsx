import { createFileRoute } from "@tanstack/react-router";
import { Check, Download, FastForward, Pause, Play, RotateCcw, Send, Star, Trophy, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { byId, me } from "@/lib/data";
import { fmt, usePlayer } from "@/lib/player";
import { beatUrl } from "@/lib/synth";
import { Avatar, Panel, Waveform } from "@/components/arena/bits";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/gauntlet")({
  head: () => ({
    meta: [
      { title: "The Gauntlet — Live Producer Quick Battle | The Arena" },
      { name: "description", content: "8 producers, one sample kit, 15 minutes. Create, upload, listen together and judge live." },
      { property: "og:title", content: "The Gauntlet — Live Producer Quick Battle" },
      { property: "og:description", content: "8 producers, one sample kit, 15 minutes. Create, upload, listen together and judge live." },
    ],
  }),
  component: Gauntlet,
});

const roster = [me.id, "tonemadelt", "dretracks", "kayobeats", "kairo", "flexmadelt", "soundmason", "novarae"];
const stages = ["Ready Up", "Sample Kit", "Create", "Upload", "Listen & Judge", "Results"] as const;
type Stage = 0 | 1 | 2 | 3 | 4 | 5;
const durations: Record<number, number> = { 1: 20, 2: 15 * 60, 3: 3 * 60 };
const SEG = 45;
const emojis = ["🔥", "💯", "😮", "😍", "👏", "🎧", "🤯", "😤", "🙌", "😂"];
const kit = ["Dusty Rhodes Chord.wav", "Vinyl Crackle Loop.wav", "808 Boom (C).wav", "Choir Stab.wav", "Perc Shaker.wav"];
const chatLines = ["this kit is crazy 😤", "that bounce tho", "drums hitting different", "who flipped the choir 👀", "certified heat", "mix a lil muddy but vibe is there", "W", "rewind that 🔁"];

function Gauntlet() {
  const pl = usePlayer();
  const [stage, setStage] = useState<Stage>(0);
  const [demo, setDemo] = useState(true);
  const [left, setLeft] = useState(0);
  const [ready, setReady] = useState<string[]>([]);
  const [downloaded, setDownloaded] = useState(false);
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [idx, setIdx] = useState(0);
  const [pos, setPos] = useState(0);
  const [myRatings, setMyRatings] = useState<Record<number, number>>({});
  const [bursts, setBursts] = useState<{ id: number; e: string; x: number }[]>([]);
  const [chat, setChat] = useState<{ who: string; t: string }[]>([{ who: "judgeraye", t: "Welcome to Gauntlet #2041 🎛️" }]);
  const [msg, setMsg] = useState("");
  const audio = useRef<HTMLAudioElement | null>(null);
  const speed = demo ? 30 : 1;

  const botRatings = useMemo(() => roster.map((_, i) => Array.from({ length: 7 }, (_, k) => 2.5 + ((i * 7 + k * 3) % 5) * 0.55)), []);

  // stage timers
  useEffect(() => {
    if (stage >= 1 && stage <= 3) setLeft(durations[stage]);
  }, [stage]);
  useEffect(() => {
    if (stage < 1 || stage > 3) return;
    const id = setInterval(() => setLeft((l) => Math.max(0, l - speed)), 1000);
    return () => clearInterval(id);
  }, [stage, speed]);
  useEffect(() => {
    if (stage >= 1 && stage <= 3 && left === 0) {
      if (stage === 3 && !uploaded) setUploaded("auto-submitted_draft.wav");
      setStage((s) => (s + 1) as Stage);
    }
  }, [left, stage, uploaded]);

  // waiting room: bots ready up
  useEffect(() => {
    if (stage !== 0) return;
    const id = setInterval(() => setReady((r) => { const next = roster.slice(1).find((x) => !r.includes(x)); return next ? [...r, next] : r; }), demo ? 400 : 1500);
    return () => clearInterval(id);
  }, [stage, demo]);
  useEffect(() => {
    if (stage === 0 && ready.length === 8) { const t = setTimeout(() => setStage(1), 800); return () => clearTimeout(t); }
  }, [ready, stage]);

  // listening session
  useEffect(() => {
    if (stage !== 4) { audio.current?.pause(); return; }
    pl.pause(); // auto-pause global player
    toast("Global player paused for the live listening session");
    const a = new Audio();
    audio.current = a;
    return () => { a.pause(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);
  useEffect(() => {
    if (stage !== 4 || !audio.current) return;
    const a = audio.current;
    a.src = beatUrl(100 + idx, SEG);
    a.playbackRate = demo ? 2 : 1;
    setPos(0);
    void a.play().catch(() => {});
    a.ontimeupdate = () => setPos(a.currentTime);
    a.onended = () => next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, idx]);
  useEffect(() => { if (audio.current) audio.current.playbackRate = demo ? 2 : 1; }, [demo]);

  // bot chat & reactions while listening
  useEffect(() => {
    if (stage !== 4) return;
    const id = setInterval(() => {
      const who = roster[1 + Math.floor(Math.random() * 7)];
      setChat((c) => [...c.slice(-30), { who, t: chatLines[Math.floor(Math.random() * chatLines.length)] }]);
      burst(emojis[Math.floor(Math.random() * emojis.length)]);
    }, 1800);
    return () => clearInterval(id);
  }, [stage]);

  function burst(e: string) {
    const id = Math.random();
    setBursts((b) => [...b, { id, e, x: 10 + Math.random() * 80 }]);
    setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 2200);
  }
  function next() {
    setIdx((i) => { if (i >= 7) { setStage(5); return i; } return i + 1; });
  }
  function reset() {
    setStage(0); setReady([]); setDownloaded(false); setUploaded(null); setIdx(0); setMyRatings({});
  }
  function skip() {
    if (stage === 0) { setReady(roster.slice()); setStage(1); }
    else if (stage >= 1 && stage <= 3) setLeft(0);
    else if (stage === 4) next();
  }

  const results = roster.map((id, i) => {
    const r = [...botRatings[i], ...(myRatings[i] ? [myRatings[i]] : [])];
    return { id, avg: r.reduce((a, b) => a + b, 0) / r.length };
  }).sort((a, b) => b.avg - a.avg);
  const xp = [500, 350, 250, 150, 100, 75, 50, 50];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-widest text-coral">● LIVE · PRODUCER QUICK BATTLE #2041</p>
          <h1 className="text-3xl font-bold italic md:text-4xl">THE GAUNTLET</h1>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 rounded-full border bg-surface px-3 py-1.5 text-sm"><Switch checked={demo} onCheckedChange={setDemo} aria-label="Demo mode" />Demo Mode {demo && <span className="text-xs text-gold">30×</span>}</label>
          {stage < 5 && <button onClick={skip} className="flex items-center gap-1 rounded-full bg-violet px-3 py-1.5 text-sm font-semibold text-primary-foreground"><FastForward className="h-4 w-4" />Skip</button>}
          <button onClick={reset} aria-label="Restart" className="grid h-8 w-8 place-items-center rounded-full border"><RotateCcw className="h-4 w-4" /></button>
        </div>
      </div>

      {/* stepper */}
      <ol className="no-scrollbar flex gap-2 overflow-x-auto">
        {stages.map((s, i) => (
          <li key={s} className={cn("flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-xs", i === stage ? "border-violet bg-violet/15 text-violet" : i < stage ? "text-teal" : "text-muted-foreground")}>
            {i < stage ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}{s}
          </li>
        ))}
      </ol>

      {stage >= 1 && stage <= 3 && (
        <Panel className="flex flex-wrap items-center justify-between gap-4 border-violet/40">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{stage === 1 ? "Kit download window" : stage === 2 ? "Creation countdown" : "Upload window closes in"}</p>
            <p className={cn("font-display text-5xl font-bold tabular-nums", left < 60 && stage > 1 ? "text-coral" : "text-foreground")}>{fmt(left)}</p>
          </div>
          <div className="h-2 min-w-48 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-gradient-to-r from-violet to-coral transition-all" style={{ width: `${100 - (left / durations[stage]) * 100}%` }} /></div>
        </Panel>
      )}

      {stage === 0 && (
        <Panel>
          <h2 className="text-xl font-bold">Waiting Room</h2>
          <p className="text-sm text-muted-foreground">Battle starts when all 8 producers are ready.</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {roster.map((id) => {
              const r = ready.includes(id);
              return (
                <div key={id} className={cn("flex flex-col items-center gap-2 rounded-xl border p-4", r && "border-teal/60 bg-teal/5")}>
                  <Avatar id={id} size={56} />
                  <p className="text-sm font-semibold">{id === me.id ? "You" : byId(id).name}</p>
                  <span className={cn("text-xs", r ? "text-teal" : "text-muted-foreground")}>{r ? "READY" : "waiting…"}</span>
                </div>
              );
            })}
          </div>
          <button disabled={ready.includes(me.id)} onClick={() => setReady((r) => [...r, me.id])} className="mt-6 w-full rounded-xl bg-violet py-3 font-semibold text-primary-foreground glow-violet disabled:opacity-50">{ready.includes(me.id) ? `Ready! (${ready.length}/8)` : "Ready Up"}</button>
        </Panel>
      )}

      {stage === 1 && (
        <Panel className="space-y-4">
          <h2 className="text-xl font-bold">Sample Kit Revealed: “Sunday Service”</h2>
          <div className="grid gap-2 sm:grid-cols-2">{kit.map((k, i) => (
            <div key={k} className="flex items-center gap-3 rounded-xl border bg-background p-3"><Waveform seed={200 + i} bars={24} className="h-6 max-w-24" /><span className="truncate text-sm">{k}</span></div>
          ))}</div>
          <button onClick={() => { setDownloaded(true); toast.success("Kit downloaded (5 files, 12 MB)"); }} className="flex items-center gap-2 rounded-xl bg-teal px-5 py-2.5 font-semibold text-primary-foreground"><Download className="h-4 w-4" />{downloaded ? "Downloaded ✓" : "Download Kit"}</button>
        </Panel>
      )}

      {stage === 2 && (
        <Panel className="space-y-3 text-center">
          <h2 className="text-xl font-bold">Cook time 🔥</h2>
          <p className="text-sm text-muted-foreground">Build a 45-second beat using the kit. Other producers are working…</p>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">{roster.map((id, i) => (
            <div key={id} className="flex flex-col items-center gap-1"><Avatar id={id} size={40} /><span className="text-[10px] text-muted-foreground">{["in DAW", "chopping", "drums", "mixing"][(i + Math.floor(left / 30)) % 4]}</span></div>
          ))}</div>
        </Panel>
      )}

      {stage === 3 && (
        <Panel>
          <h2 className="mb-3 text-xl font-bold">Upload Your Entry</h2>
          <label
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; setUploaded(f?.name ?? "my_beat.wav"); }}
            className={cn("flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-10 text-center transition", drag ? "border-violet bg-violet/10" : "border-border")}
          >
            <Upload className="h-8 w-8 text-violet" />
            <p className="font-semibold">{uploaded ? `✓ ${uploaded}` : "Drag & drop your 45s beat here"}</p>
            <p className="text-xs text-muted-foreground">or click to browse · WAV/MP3 · 45 seconds max</p>
            <input type="file" accept="audio/*" className="sr-only" onChange={(e) => setUploaded(e.target.files?.[0]?.name ?? null)} />
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={() => setUploaded("sunday_service_flip_FINAL.wav")} className="rounded-lg border px-4 py-2 text-sm">Simulate upload</button>
            <button disabled={!uploaded} onClick={() => setLeft(0)} className="rounded-lg bg-violet px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40">Lock In & Continue</button>
          </div>
        </Panel>
      )}

      {stage === 4 && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Panel className="relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0" aria-hidden>
              {bursts.map((b) => <span key={b.id} className="animate-float-up absolute bottom-10 text-3xl" style={{ left: `${b.x}%` }}>{b.e}</span>)}
            </div>
            <p className="text-xs text-muted-foreground">Beat {idx + 1} of 8 · Synchronized for all listeners</p>
            <div className="mt-3 flex items-center gap-4">
              <Avatar id={roster[idx]} size={64} ring />
              <div className="min-w-0">
                <h2 className="truncate text-2xl font-bold">{roster[idx] === me.id ? "Your Entry" : `${byId(roster[idx]).name}'s Beat`}</h2>
                <p className="text-sm text-muted-foreground">Sunday Service Flip · 45s</p>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <button aria-label="Play or pause" onClick={() => { const a = audio.current; if (!a) return; if (a.paused) void a.play(); else a.pause(); }} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-violet text-primary-foreground">{audio.current?.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}</button>
              <Waveform seed={100 + idx} bars={70} progress={pos / SEG} className="h-12" />
              <span className="w-20 text-right text-sm tabular-nums">{fmt(pos)} / {fmt(SEG)}</span>
            </div>
            <div className="mt-6">
              <p className="mb-2 text-sm font-semibold">Rate this beat</p>
              {roster[idx] === me.id ? (
                <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">You can't rate your own entry.</p>
              ) : (
                <div className="flex gap-2" role="radiogroup" aria-label="Rating">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} role="radio" aria-checked={myRatings[idx] === n} aria-label={`${n} stars`} onClick={() => setMyRatings({ ...myRatings, [idx]: n })} className={cn("grid h-11 w-11 place-items-center rounded-lg border", (myRatings[idx] ?? 0) >= n ? "border-gold bg-gold/15 text-gold" : "text-muted-foreground")}>
                      <Star className={cn("h-5 w-5", (myRatings[idx] ?? 0) >= n && "fill-current")} />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {emojis.map((e) => <button key={e} aria-label={`React ${e}`} onClick={() => burst(e)} className="grid h-10 w-10 place-items-center rounded-full border bg-background text-xl transition hover:scale-110">{e}</button>)}
            </div>
            <div className="mt-6 grid grid-cols-8 gap-1">{roster.map((id, i) => <div key={id} className={cn("h-1.5 rounded-full", i < idx ? "bg-teal" : i === idx ? "bg-violet" : "bg-muted")} />)}</div>
          </Panel>
          <Panel className="flex h-[520px] flex-col">
            <h3 className="mb-2 font-semibold">Live Chat</h3>
            <div className="flex-1 space-y-2 overflow-y-auto text-sm" aria-live="polite">
              {chat.map((c, i) => <p key={i}><span className="font-semibold text-violet">{c.who === me.id ? "You" : byId(c.who).name}:</span> {c.t}</p>)}
            </div>
            <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!msg) return; setChat([...chat, { who: me.id, t: msg }]); setMsg(""); }}>
              <input value={msg} onChange={(e) => setMsg(e.target.value)} aria-label="Chat message" placeholder="Say something…" className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-violet" />
              <button aria-label="Send" className="grid h-9 w-9 place-items-center rounded-lg bg-violet text-primary-foreground"><Send className="h-4 w-4" /></button>
            </form>
          </Panel>
        </div>
      )}

      {stage === 5 && (
        <Panel className="space-y-6">
          <h2 className="flex items-center gap-2 text-2xl font-bold"><Trophy className="h-6 w-6 text-gold" />Final Results</h2>
          <div className="grid grid-cols-3 items-end gap-3">
            {[1, 0, 2].map((p) => {
              const r = results[p];
              return (
                <div key={r.id} className="flex flex-col items-center gap-2">
                  <Avatar id={r.id} size={p === 0 ? 72 : 56} ring={p === 0} />
                  <p className="text-sm font-semibold">{r.id === me.id ? "You" : byId(r.id).name}</p>
                  <div className={cn("flex w-full flex-col items-center justify-center rounded-t-xl", p === 0 ? "h-32 bg-gold/20 text-gold" : p === 1 ? "h-24 bg-violet/20 text-violet" : "h-20 bg-coral/20 text-coral")}>
                    <span className="font-display text-3xl font-bold">{p + 1}</span><span className="text-xs">{r.avg.toFixed(2)}★</span>
                  </div>
                </div>
              );
            })}
          </div>
          <ol className="divide-y rounded-xl border">
            {results.map((r, i) => (
              <li key={r.id} className={cn("flex items-center gap-3 p-3", r.id === me.id && "bg-violet/10")}>
                <span className="w-6 font-display font-bold text-muted-foreground">{i + 1}</span>
                <Avatar id={r.id} size={32} />
                <span className="flex-1 truncate text-sm font-medium">{r.id === me.id ? "You (Blaze)" : byId(r.id).name}</span>
                <span className="text-sm text-gold">{r.avg.toFixed(2)}★</span>
                <span className="w-20 text-right text-sm text-teal">+{xp[i]} XP</span>
              </li>
            ))}
          </ol>
          <button onClick={reset} className="rounded-xl bg-violet px-5 py-2.5 font-semibold text-primary-foreground">Run it back</button>
        </Panel>
      )}
    </div>
  );
}
