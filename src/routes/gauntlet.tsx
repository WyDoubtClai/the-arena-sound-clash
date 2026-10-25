import { createFileRoute } from "@tanstack/react-router";
import { Check, Download, FastForward, Pause, Play, RotateCcw, Send, Trophy, Upload } from "lucide-react";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { byId, me } from "@/lib/data";
import { fmt, usePlayer } from "@/lib/player";
import { beatUrl } from "@/lib/synth";
import { Avatar, Panel, PlayButton, Waveform } from "@/components/arena/bits";
import { Switch } from "@/components/ui/switch";
import { BattleParticipants, BattleCountdown, BattleRating } from "@/components/arena/battle-controls";
import { clockAt, clockReducer, durations, readClock, saveClock } from "@/lib/gauntlet-clock";

export const Route = createFileRoute("/gauntlet")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
const SEG = 45;
const emojis = ["🔥", "💯", "😮", "😍", "👏", "🎧", "🤯", "😤", "🙌", "😂"];
const kit = { id: "sunday-service", title: "Sunday Service", samples: ["Dusty Rhodes Chord.wav", "Vinyl Crackle Loop.wav", "808 Boom (C).wav", "Choir Stab.wav", "Perc Shaker.wav"] };
const chatLines = ["this kit is crazy 😤", "that bounce tho", "drums hitting different", "who flipped the choir 👀", "certified heat", "mix a lil muddy but vibe is there", "W", "rewind that 🔁"];

function Gauntlet() {
  const pl = usePlayer();
  const [clock, dispatchClock] = useReducer(clockReducer, undefined, () => clockAt(0));
  const { stage, left, speed } = clock;
  const demo = speed === 30;
  const revealedKit = clock.revealedKitId === kit.id ? kit : null;
  const [clockLoaded, setClockLoaded] = useState(false);
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

  useEffect(() => {
    const saved = readClock();
    if (saved?.progress) {
      setUploaded(saved.progress.uploaded); setIdx(saved.progress.index);
      setMyRatings(saved.progress.ratings); setDownloaded(saved.progress.downloaded);
    }
    dispatchClock({ type: "restore", clock: saved ?? clockAt(0) });
    setClockLoaded(true);
  }, []);
  useEffect(() => {
    if (clockLoaded) saveClock({ ...clock, progress: { uploaded, index: idx, ratings: myRatings, downloaded } });
  }, [clock, clockLoaded, uploaded, idx, myRatings, downloaded]);

  const botRatings = useMemo(() => roster.map((_, i) => Array.from({ length: 7 }, (_, k) => 2.5 + ((i * 7 + k * 3) % 5) * 0.55)), []);

  useEffect(() => {
    if (!clockLoaded || (stage !== 2 && stage !== 3)) return;
    const id = setInterval(() => dispatchClock({ type: "tick", from: stage, now: Date.now() }), 1000);
    return () => clearInterval(id);
  }, [stage, speed, clockLoaded]);

  // waiting room: bots ready up
  useEffect(() => {
    if (stage !== 0) return;
    const id = setInterval(() => setReady((r) => { const next = roster.slice(1).find((x) => !r.includes(x)); return next ? [...r, next] : r; }), demo ? 400 : 1500);
    return () => clearInterval(id);
  }, [stage, demo]);
  useEffect(() => {
    if (stage !== 0 || ready.length !== 8) return undefined;
    const t = setTimeout(() => revealSampleKit(kit), 800);
    return () => clearTimeout(t);
  }, [ready, stage]);

  // listening session
  useEffect(() => {
    if (stage !== 4) { audio.current?.pause(); return; }
    setUploaded((file) => file ?? "auto-submitted_draft.wav");
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
    return () => { a.ontimeupdate = null; a.onended = null; };
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
    if (idx >= 7) dispatchClock({ type: "advance", from: 4, now: Date.now() });
    else setIdx(idx + 1);
  }
  function reset() {
    audio.current?.pause();
    dispatchClock({ type: "reset", now: Date.now() });
    setReady([]); setDownloaded(false); setUploaded(null); setIdx(0); setMyRatings({});
    setPos(0); setDrag(false); setBursts([]); setMsg("");
    setChat([{ who: "judgeraye", t: "Welcome to Gauntlet #2041 🎛️" }]);
  }
  // Call only when the chosen kit is actually revealed, including after any future selection phase.
  function revealSampleKit(selectedKit: typeof kit) {
    dispatchClock({ type: "kit-revealed", kitId: selectedKit.id, now: Date.now() });
  }
  function skip() {
    if (stage === 4) next();
    else if (stage < 4) {
      if (stage === 0) setReady(roster.slice());
      if (stage === 0 || stage === 1) revealSampleKit(kit);
      else dispatchClock({ type: "advance", from: stage, now: Date.now() });
    }
  }
  function downloadSample(index: number) {
    const link = document.createElement("a");
    link.href = beatUrl(200 + index, 8);
    link.download = kit.samples[index];
    link.click();
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
          <label className="flex items-center gap-2 rounded-full border bg-surface px-3 py-1.5 text-sm"><Switch checked={demo} onCheckedChange={(enabled) => dispatchClock({ type: "speed", speed: enabled ? 30 : 1, now: Date.now() })} aria-label="Demo mode" />Demo Mode {demo && <span className="text-xs text-gold">30×</span>}</label>
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

      {(stage === 2 || stage === 3) && (
        <Panel className="flex flex-wrap items-center justify-between gap-4 border-violet/40">
          <BattleCountdown label={stage !== 3 ? "Creation countdown" : "Upload window closes in"} left={left} urgent />
          <div className="h-2 min-w-48 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-gradient-to-r from-violet to-coral transition-all" style={{ width: `${100 - (left / durations[stage]) * 100}%` }} /></div>
        </Panel>
      )}

      {stage === 0 && (
        <Panel>
          <h2 className="text-xl font-bold">Waiting Room</h2>
          <p className="text-sm text-muted-foreground">Battle starts when all 8 producers are ready.</p>
          <BattleParticipants roster={roster} ready={ready} />
          <button disabled={ready.includes(me.id)} onClick={() => setReady((r) => [...r, me.id])} className="mt-6 w-full rounded-xl bg-violet py-3 font-semibold text-primary-foreground glow-violet disabled:opacity-50">{ready.includes(me.id) ? `Ready! (${ready.length}/8)` : "Ready Up"}</button>
        </Panel>
      )}

      {revealedKit && stage === 2 && (
        <Panel className="space-y-4">
          <h2 className="text-xl font-bold">Sample Kit Revealed: “{revealedKit.title}”</h2>
          <p className="text-sm text-muted-foreground">Creation starts automatically when the kit is revealed. Preview or download while the clock runs. These five 8-second samples are synthesized demo audio.</p>
          <div className="grid gap-2 sm:grid-cols-2">{revealedKit.samples.map((k, i) => (
            <div key={k} className="flex min-w-0 items-center gap-3 rounded-xl border bg-background p-3"><PlayButton track={{ id: `gauntlet-kit-${i}`, title: k, artist: "Sunday Service · demo kit", seed: 200 + i, seconds: 8 }} size="sm" /><span className="min-w-0 flex-1 break-words text-sm">{k}</span><button aria-label={`Download ${k}`} onClick={() => downloadSample(i)} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border"><Download className="h-4 w-4" /></button></div>
          ))}</div>
          <button onClick={() => { revealedKit.samples.forEach((_, i) => downloadSample(i)); setDownloaded(true); toast.success("Demo kit downloads requested. If your browser blocks multiple downloads, use each sample's download button."); }} className="flex items-center gap-2 rounded-xl bg-teal px-5 py-2.5 font-semibold text-primary-foreground"><Download className="h-4 w-4" />{downloaded ? "Download Kit Again" : "Download Kit"}</button>
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
            <button disabled={!uploaded} onClick={() => dispatchClock({ type: "advance", from: 3, now: Date.now() })} className="rounded-lg bg-violet px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40">Lock In & Continue</button>
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
              <BattleRating own={roster[idx] === me.id} value={myRatings[idx]} onChange={(n) => setMyRatings({ ...myRatings, [idx]: n })} />
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
