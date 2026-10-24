import { createFileRoute } from "@tanstack/react-router";
import { Check, FastForward, Gift, RotateCcw, Send, Trophy, Upload, Vote } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, AudioEmbed, Panel, PlayButton, Waveform } from "@/components/arena/bits";
import { BattleCountdown, BattleParticipants, BattleRating } from "@/components/arena/battle-controls";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ARTIST_DURATIONS, ARTIST_ROSTER, ARTIST_STAGES, BALLOT_SEED, DEMO_SPEED, PERFORMANCE_LIMIT, PROMPT, canRate, closeBallot, drawBeats, rankArtists, seconds, segmentBounds } from "@/lib/artist-battle";
import { byId, me } from "@/lib/data";
import { usePlayer, type Track } from "@/lib/player";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/artist-quick-battle")({
  head: () => ({ meta: [
    { title: "Artist Quick Battle — The Arena" },
    { name: "description", content: "Eight artists, one Crate instrumental and a shared prompt. Vote, write, submit and judge in the Phase 1 demo." },
    { property: "og:title", content: "Artist Quick Battle — The Arena" },
    { property: "og:description", content: "Draw a beat from The Crate and compete in a seven-stage artist battle demo." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: ArtistQuickBattle,
});

const emoji = ["🔥", "💯", "👏", "🎧", "🙌"];
const demoChat = ["That hook hits 🔥", "Same beat, totally different story", "Love this take", "Great delivery 👏"];

function ArtistQuickBattle() {
  const player = usePlayer();
  const [stage, setStage] = useState(0);
  const [demo, setDemo] = useState(true);
  const [left, setLeft] = useState(0);
  const [ready, setReady] = useState<string[]>([]);
  const [vote, setVote] = useState<string | null>(null);
  const [ballot, setBallot] = useState<ReturnType<typeof closeBallot> | null>(null);
  const [lyrics, setLyrics] = useState("");
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [ratings, setRatings] = useState<Record<number, number>>({});
  const [chat, setChat] = useState([{ who: "judgeraye", text: "Welcome to Artist Quick Battle #2042", simulated: true }]);
  const [message, setMessage] = useState("");
  const [reactions, setReactions] = useState<string[]>([]);
  const played = useRef(false);
  const lastStage = useRef(0);
  const choices = useMemo(() => drawBeats(), []);
  const winner = ballot?.winner;
  const results = rankArtists(ratings);
  const currentId = ARTIST_ROSTER[index];
  const submission: Track = { id: `artist-entry-${index}`, title: currentId === me.id ? "Your Entry" : `${byId(currentId).name}'s Entry`, artist: byId(currentId).name, seed: 300 + index, seconds: PERFORMANCE_LIMIT };
  const beatTrack: Track | null = winner ? { id: `artist-segment-${winner.id}`, title: `${winner.title} · 60s segment`, artist: byId(winner.producer).name, seed: winner.seed, seconds: seconds(winner.duration), segmentStart: segmentBounds(winner)[0], segmentDuration: PERFORMANCE_LIMIT } : null;

  function advance() {
    player.pause();
    if (stage === 1) {
      if (!vote) return;
      setBallot(closeBallot(choices, vote));
    }
    if (stage === 4 && !uploaded) setUploaded("simulated_artist_draft.wav");
    const next = Math.min(6, stage + 1);
    setLeft(ARTIST_DURATIONS[next] ?? 0);
    setStage(next);
  }
  function nextEntry() {
    player.pause();
    played.current = false;
    if (index === ARTIST_ROSTER.length - 1) setStage(6);
    else setIndex((value) => value + 1);
  }
  function restart() {
    player.pause();
    setStage(0); setLeft(0); setReady([]); setVote(null); setBallot(null); setLyrics(""); setUploaded(null); setIndex(0); setRatings({}); setReactions([]);
    setChat([{ who: "judgeraye", text: "Welcome to Artist Quick Battle #2042", simulated: true }]); setMessage(""); played.current = false;
  }
  function react(value: string) { setReactions((previous) => [...previous.slice(-7), value]); }

  // Set timers on entry, never in an effect that can observe a stale zero.
  useEffect(() => {
    if (stage !== 0) return;
    const interval = setInterval(() => setReady((previous) => {
      const next = ARTIST_ROSTER.slice(1).find((id) => !previous.includes(id));
      return next ? [...previous, next] : previous;
    }), demo ? 400 : 1500);
    return () => clearInterval(interval);
  }, [stage, demo]);
  useEffect(() => {
    if (stage !== 0 || ready.length !== 8) return;
    const timeout = setTimeout(() => { setLeft(ARTIST_DURATIONS[1]); setStage(1); }, 800);
    return () => clearTimeout(timeout);
  }, [stage, ready]);
  useEffect(() => {
    if (!(stage in ARTIST_DURATIONS) || left <= 0) return;
    const timeout = setTimeout(() => setLeft((value) => Math.max(0, value - (demo ? DEMO_SPEED : 1))), 1000);
    return () => clearTimeout(timeout);
  }, [stage, left, demo]);
  useEffect(() => {
    if (left !== 0 || !(stage in ARTIST_DURATIONS) || (stage === 1 && !vote)) return;
    advance();
    // advance reads the latest vote and submission; only a timed stage can trigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, stage, vote]);
  useEffect(() => {
    if (lastStage.current !== stage) { player.pause(); lastStage.current = stage; }
    if (stage !== 5) return;
    played.current = false;
    player.play(submission);
    // Only changing the stage or entry starts a sequential preview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, index]);
  useEffect(() => {
    if (stage !== 5 || player.track?.id !== submission.id) return;
    if (player.playing) played.current = true;
    if (played.current && !player.playing && player.time >= PERFORMANCE_LIMIT - 0.2) nextEntry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, player.time, player.playing, player.track?.id]);
  useEffect(() => {
    if (stage !== 5 || !demo) return;
    const timeout = setTimeout(nextEntry, PERFORMANCE_LIMIT / DEMO_SPEED * 1000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, index, demo]);
  useEffect(() => {
    if (stage !== 5) return;
    const interval = setInterval(() => {
      setChat((previous) => [...previous.slice(-25), { who: ARTIST_ROSTER[1 + Math.floor(Math.random() * 7)], text: demoChat[Math.floor(Math.random() * demoChat.length)], simulated: true }]);
      react(emoji[Math.floor(Math.random() * emoji.length)]);
    }, 1800);
    return () => clearInterval(interval);
  }, [stage]);

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-xs font-semibold tracking-widest text-coral">PHASE 1 DEMO · ROOM #2042</p><h1 className="text-3xl font-bold md:text-4xl">Artist Quick Battle</h1></div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 rounded-full border bg-surface px-3 py-1.5 text-sm"><Switch checked={demo} onCheckedChange={setDemo} aria-label="Demo mode" />Demo Mode {demo && <span className="text-xs text-gold">30×</span>}</label>
        {stage < 6 && <Button disabled={stage === 1 && !vote} onClick={() => stage === 5 ? nextEntry() : advance()}><FastForward />Skip</Button>}
        <Button variant="outline" size="icon" title="Restart demo" aria-label="Restart" onClick={restart}><RotateCcw /></Button>
      </div>
    </div>
    <ol className="no-scrollbar flex gap-2 overflow-x-auto" aria-label="Battle stages">{ARTIST_STAGES.map((name, i) => <li key={name} aria-current={stage === i ? "step" : undefined} className={cn("flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-xs", i === stage ? "border-violet bg-violet/15 text-violet" : i < stage ? "text-teal" : "text-muted-foreground")}>{i < stage ? <Check className="h-3 w-3" /> : i + 1}{name}</li>)}</ol>
    <p className="text-xs text-muted-foreground">Frontend demo · all other participants, votes, submissions and rewards are simulated.</p>

    {stage === 0 && <section><h2 className="text-xl font-bold">Waiting Room</h2><p className="text-sm text-muted-foreground">All eight artists must be ready.</p><BattleParticipants roster={ARTIST_ROSTER} ready={ready} /><Button className="mt-5 w-full" disabled={ready.includes(me.id)} onClick={() => setReady((previous) => [...previous, me.id])}>{ready.includes(me.id) ? `Ready! (${ready.length}/8)` : "Ready Up"}</Button></section>}

    {stage === 1 && <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4"><h2 className="text-xl font-bold">The Crate Draw</h2><BattleCountdown label="Ballot closes in" left={left} /></div>
      <p className="text-sm text-muted-foreground">Four eligible instrumentals from The Crate · anonymous 30-second previews · one vote per artist.</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{choices.map((beat, i) => <Panel key={beat.id} className={cn("space-y-3", vote === beat.id && "border-violet")}><AudioEmbed track={{ id: `blind-${beat.id}`, title: `Instrumental ${String.fromCharCode(65 + i)}`, artist: "Anonymous Crate preview", seed: beat.seed }} /><Button className="w-full" variant={vote === beat.id ? "default" : "outline"} aria-pressed={vote === beat.id} onClick={() => setVote(beat.id)}><Vote />{vote === beat.id ? "Your vote" : `Vote ${String.fromCharCode(65 + i)}`}</Button></Panel>)}</div>
      <p className="text-xs text-muted-foreground">Simulated ballots: Nova Rae → A, Lyric K → B, Mia Soul → B, Lexi Vibes → C, Verse → C, Amira → D, Juno → A. Your vote is the eighth ballot. Ties use a seeded random draw among tied choices (room seed {BALLOT_SEED}); restarting this room repeats the same draw.</p>
      {!vote && left === 0 && <p className="text-sm text-coral">Cast your vote to close the ballot.</p>}
      <Button disabled={!vote} onClick={advance}>Close Ballot</Button>
    </section>}

    {stage === 2 && ballot && winner && <section className="space-y-4">
      <h2 className="text-xl font-bold">Beat & Prompt Reveal</h2>
      <div className="grid gap-3 sm:grid-cols-4">{ballot.counts.map((row, i) => <Panel key={row.beat.id} className={cn("space-y-1", row.beat.id === winner.id && "border-gold")}><p className="text-sm">Instrumental {String.fromCharCode(65 + i)}</p><p className="text-2xl font-bold text-gold">{row.count} votes</p><p className="text-xs text-muted-foreground">{ballot.simulated.filter((v) => v.beatId === row.beat.id).length} simulated{vote === row.beat.id ? " + your vote" : ""}</p></Panel>)}</div>
      <p className="text-sm text-muted-foreground">{ballot.total}/8 ballots counted.{ballot.tied ? ` Tie resolved by the seeded random tiebreaker (${BALLOT_SEED}).` : " Majority winner selected."}</p>
      <h3 className="text-xl font-bold text-gold">Selected: {winner.title}</h3>
      <p className="text-sm">Produced by {byId(winner.producer).name}{winner.giveaway && <span className="ml-2 text-gold">· Beat Gift eligible</span>}</p>
      <p className="text-sm">All eight artists receive this same instrumental and prompt simultaneously. Creation starts only when the reveal ends.</p>
      <Button onClick={advance}>Begin 15-Minute Creation</Button>
    </section>}

    {stage >= 2 && stage <= 5 && winner && beatTrack && <section className="space-y-3 border-y py-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{winner.title} · {byId(winner.producer).name}</h3>{winner.giveaway && <span className="flex items-center gap-1 text-xs text-gold"><Gift className="h-3 w-3" />Giveaway</span>}</div>
      <p className="text-sm text-teal">Prompt: {PROMPT}</p>
      <p className="text-xs text-muted-foreground">Competition segment {winner.segment} · full 60 seconds · synthesized demo audio</p>
      <AudioEmbed track={beatTrack} />
    </section>}

    {stage === 3 && <section className="space-y-4"><BattleCountdown label="Creation countdown" left={left} urgent /><h2 className="text-xl font-bold">Write & Record</h2><label className="block space-y-2"><span className="text-sm text-muted-foreground">Your writing draft</span><textarea value={lyrics} onChange={(e) => setLyrics(e.target.value)} aria-label="Writing draft" rows={6} className="w-full rounded-lg border bg-surface p-3 text-sm outline-none focus:border-violet" /></label><div className="grid grid-cols-4 gap-3 sm:grid-cols-8">{ARTIST_ROSTER.map((id, i) => <div key={id} className="flex flex-col items-center gap-1"><Avatar id={id} /><span className="text-[10px] text-muted-foreground">{id === me.id ? "You" : ["writing", "recording", "rehearsing"][(i + Math.floor(left / 30)) % 3]}</span></div>)}</div></section>}

    {stage === 4 && <section className="space-y-4"><BattleCountdown label="Upload window closes in" left={left} urgent /><h2 className="text-xl font-bold">Upload Your Performance</h2><label onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); setUploaded(e.dataTransfer.files[0]?.name ?? null); }} className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 text-center"><Upload className="h-8 w-8 text-violet" /><span>{uploaded ?? "Choose or drop your performance"}</span><span className="text-xs text-muted-foreground">WAV / MP3 · 60 seconds maximum</span><input aria-label="Artist performance" className="sr-only" type="file" accept="audio/*" onChange={(e) => setUploaded(e.target.files?.[0]?.name ?? null)} /></label><p className="text-xs text-muted-foreground">Local filename preview only. Nothing is uploaded or stored. A fictional draft is submitted if this window ends without a selection.</p><div className="flex flex-wrap gap-3"><Button variant="outline" onClick={() => setUploaded("after_midnight_demo.wav")}>Simulate upload</Button><Button disabled={!uploaded} onClick={advance}>Lock In & Continue</Button></div></section>}

    {stage === 5 && <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-4"><h2 className="text-xl font-bold">Listen & Judge</h2><p className="text-xs text-muted-foreground">Simulated submission {index + 1} of 8 · {demo ? "30× sequence: next entry every 2 seconds" : "Sequential 60-second previews"} · instrumental-only demonstration audio</p><div className="flex items-center gap-3"><Avatar id={currentId} size={56} /><h3 className="text-xl font-bold">{submission.title}</h3></div><div className="flex items-center gap-3"><PlayButton track={submission} /><Waveform seed={submission.seed} bars={60} progress={player.track?.id === submission.id ? player.time / PERFORMANCE_LIMIT : 0} className="h-12" /></div><BattleRating own={!canRate(currentId, me.id)} value={ratings[index]} onChange={(score) => setRatings((previous) => ({ ...previous, [index]: score }))} /><div className="flex flex-wrap gap-2">{emoji.map((value) => <Button key={value} variant="outline" size="icon" aria-label={`React ${value}`} onClick={() => react(value)}>{value}</Button>)}</div><div aria-live="polite" className="flex h-8 gap-2 text-xl">{reactions.map((value, i) => <span key={i}>{value}</span>)}</div><Button variant="outline" onClick={nextEntry}>Next Submission</Button></div>
      <div className="flex h-96 flex-col border-l pl-4"><h3 className="mb-3 font-semibold">Live Chat · Demo</h3><div className="flex-1 space-y-2 overflow-y-auto text-sm" aria-live="polite">{chat.map((line, i) => <p key={i}><span className="font-semibold text-violet">{line.who === me.id ? "You" : byId(line.who).name}</span>{line.simulated && <span className="text-[10px] text-muted-foreground"> (simulated)</span>}: {line.text}</p>)}</div><form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!message.trim()) return; setChat((previous) => [...previous, { who: me.id, text: message, simulated: false }]); setMessage(""); }}><input aria-label="Chat message" placeholder="Say something…" value={message} onChange={(e) => setMessage(e.target.value)} className="min-w-0 flex-1 rounded-lg border bg-surface px-3 text-sm" /><Button aria-label="Send" size="icon"><Send /></Button></form></div>
    </section>}

    {stage === 6 && <section className="space-y-5"><h2 className="flex items-center gap-2 text-2xl font-bold"><Trophy className="text-gold" />Final Results</h2><p className="text-xs text-muted-foreground">Simulated judge averages plus your ratings · fictional demonstration XP</p><ol className="divide-y rounded-lg border">{results.map((result, i) => <li key={result.id} className={cn("flex items-center gap-3 p-3", result.id === me.id && "bg-violet/10")}><span className="w-4 font-bold text-muted-foreground">{i + 1}</span><Avatar id={result.id} size={32} /><span className="min-w-0 flex-1 truncate text-sm">{result.id === me.id ? "You (Blaze)" : byId(result.id).name}</span><span className="text-sm text-gold">{result.avg.toFixed(2)}★</span><span className="text-xs text-teal">+{[500, 350, 250, 150, 100, 75, 50, 50][i]} XP</span></li>)}</ol>{winner && <div className="space-y-2 border-y py-4"><p className="text-sm">Producer credit: <strong>{byId(winner.producer).name}</strong> · {winner.title}</p>{winner.giveaway && <p className="flex items-center gap-2 font-semibold text-gold"><Gift />Simulated Beat Gift: {byId(results[0].id).name}</p>}<p className="text-xs text-muted-foreground">No real license or download is issued in Phase 1. XP and rewards do not affect accounts.</p></div>}<Button onClick={restart}>Run it back</Button></section>}
  </div>;
}