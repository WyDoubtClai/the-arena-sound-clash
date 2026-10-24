import { createFileRoute } from "@tanstack/react-router";
import { Check, CheckCircle2, Download, FastForward, Gift, Pause, Play, RotateCcw, Send, Sparkles, Trophy, Upload, Vote } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, AudioEmbed, Panel, PlayButton, Waveform } from "@/components/arena/bits";
import { BattleCountdown, BattleParticipants, BattleRating } from "@/components/arena/battle-controls";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ARTIST_ROSTER, BALLOT_SEED, DEMO_SPEED, FORMAT_LABEL, PERFORMANCE_LIMIT, PROMPT, UPLOAD_WINDOW, ballotLabel, canRate, closeBallot, drawBeats, rankEntries, seconds, segmentBounds, shouldCloseUpload, stagesFor, submittedIds, uploadSchedule, uploadStatus, validateAudioFile, type BattleFormat } from "@/lib/artist-battle";
import { excerptWav } from "@/lib/synth";
import { beats, byId, me } from "@/lib/data";
import { downloadRewardFile, newBattleId, qualifiesForReward, rewardId, reservedBeatIds, useVault } from "@/lib/beat-vault";

const BATTLE_KEY = "arena-aqb-battle-id";
import { fmt, usePlayer, type Track } from "@/lib/player";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/artist-quick-battle")({
  validateSearch: (search: Record<string, unknown>): { format?: "song" } => (search["format"] === "song" ? { format: "song" } : {}),
  head: () => ({ meta: [
    { title: "Artist Quick Battle — The Arena" },
    { name: "description", content: "Two artist formats: a 15-minute creation battle on a shared Crate beat, or Song-for-Song with finished tracks. Phase 1 demo." },
    { property: "og:title", content: "Artist Quick Battle — The Arena" },
    { property: "og:description", content: "Creation Battle or Song-for-Song: upload, judge and see results in the Phase 1 artist battle demo." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: ArtistQuickBattle,
});

const emoji = ["🔥", "💯", "👏", "🎧", "🙌"];
const demoChat = ["That hook hits 🔥", "Same beat, totally different story", "Love this take", "Great delivery 👏"];
const XP = [500, 350, 250, 150, 100, 75, 50, 50];
const welcome = () => [{ who: "judgeraye", text: "Welcome to Artist Quick Battle #2042", simulated: true }];
type MyEntry = { name: string; url: string; seconds: number; demo?: boolean };

function audioLength(url: string) {
  return new Promise<number | undefined>((resolve) => {
    const a = new Audio(); a.preload = "metadata";
    a.onloadedmetadata = () => resolve(Number.isFinite(a.duration) ? a.duration : undefined);
    a.onerror = () => resolve(undefined); a.src = url;
  });
}

function ArtistQuickBattle() {
  const player = usePlayer();
  const navigate = Route.useNavigate();
  const format: BattleFormat = Route.useSearch().format === "song" ? "song" : "creation";
  const stages = stagesFor(format);
  const [stage, setStage] = useState(0);
  const name = stages[stage];
  const [demo, setDemo] = useState(true);
  const [left, setLeft] = useState(0);
  const [ready, setReady] = useState<string[]>([]);
  const [vote, setVote] = useState<string | null>(null);
  const [ballot, setBallot] = useState<ReturnType<typeof closeBallot> | null>(null);
  const [lyrics, setLyrics] = useState("");
  const [mine, setMine] = useState<MyEntry | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [oneMisses, setOneMisses] = useState(false);
  const [entries, setEntries] = useState<string[]>([]);
  const [closedWith, setClosedWith] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const [ratings, setRatings] = useState<Record<number, number>>({});
  const [chat, setChat] = useState(welcome);
  const [message, setMessage] = useState("");
  const [reactions, setReactions] = useState<string[]>([]);
  const played = useRef(false);
  const lastStage = useRef(0);
  const closedStage = useRef<number | null>(null);
  const vault = useVault();
  const [battleId, setBattleId] = useState("");
  useEffect(() => {
    const saved = sessionStorage.getItem(BATTLE_KEY);
    const id = saved ?? newBattleId();
    if (!saved) sessionStorage.setItem(BATTLE_KEY, id);
    setBattleId(id);
  }, []);
  const reservedKey = [...reservedBeatIds(vault.list)].sort().join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const choices = useMemo(() => drawBeats(beats.filter((b) => !reservedBeatIds(vault.list).has(b.id))), [reservedKey]);
  const schedule = useMemo(() => uploadSchedule(oneMisses), [oneMisses]);
  const winner = ballot?.winner;
  const winnerVotes = ballot?.counts.find((row) => row.beat.id === winner?.id)?.count ?? 0;
  const isUpload = name === "3-Minute Upload";
  const elapsed = UPLOAD_WINDOW - left;
  const submitted = isUpload ? submittedIds(schedule, elapsed, !!mine || (demo && left <= 0)) : entries;
  const results = rankEntries(ratings, entries);
  const missing = ARTIST_ROSTER.filter((id) => !entries.includes(id));
  const currentId = entries[index];
  const rosterIndex = ARTIST_ROSTER.indexOf(currentId);
  const submission: Track | null = !currentId ? null : currentId === me.id && mine && !mine.demo
    ? { id: `artist-entry-mine-${mine.name}`, title: `Your Entry · ${mine.name}`, artist: "You (local file)", seed: 300, seconds: mine.seconds, src: mine.url }
    : currentId === me.id ? { id: "artist-entry-mine-demo", title: "Blaze — Demo Entry (simulated audio)", artist: "You · demo submission", seed: 300, seconds: PERFORMANCE_LIMIT }
    : { id: `artist-entry-${rosterIndex}`, title: `${byId(currentId).name}'s ${format === "song" ? "Song" : "Entry"} (simulated)`, artist: byId(currentId).name, seed: 300 + rosterIndex, seconds: PERFORMANCE_LIMIT };
  const [segStart, segEnd] = winner ? segmentBounds(winner) : [0, 0];
  const beatTrack: Track | null = winner ? { id: `artist-segment-${winner.id}`, title: `${winner.title} · 60s segment`, artist: byId(winner.producer).name, seed: winner.seed, seconds: seconds(winner.duration), segmentStart: segStart, segmentDuration: PERFORMANCE_LIMIT } : null;
  const timed = (n: string) => ({ "Crate Draw": 120, "15-Minute Creation": 900, "3-Minute Upload": UPLOAD_WINDOW } as Record<string, number>)[n] ?? 0;

  function go(next: number) { setLeft(timed(stages[next])); setStage(next); }
  function advance() {
    player.pause();
    if (name === "Crate Draw") { setBallot(closeBallot(choices, vote)); go(stage + 2); return; } // reveal resolves instantly; 15:00 starts now
    if (isUpload) { setLeft(0); return; } // Skip = expire the window; the single close effect handles it.
    go(Math.min(stages.length - 1, stage + 1));
  }
  function closeUpload(valid: string[]) {
    if (closedStage.current === stage) return; // one transition per window
    closedStage.current = stage;
    player.pause();
    setEntries(valid); setClosedWith(left); setIndex(0);
    go(valid.length ? stage + 1 : stages.length - 1);
  }
  function nextEntry() {
    player.pause();
    played.current = false;
    if (index >= entries.length - 1) go(stages.length - 1);
    else setIndex((value) => value + 1);
  }
  function restart(nextFormat = format) {
    player.pause();
    const fresh = newBattleId(); sessionStorage.setItem(BATTLE_KEY, fresh); setBattleId(fresh);
    if (mine?.url) URL.revokeObjectURL(mine.url);
    setStage(0); setLeft(0); setReady([]); setVote(null); setBallot(null); setLyrics(""); setMine(null); setFileError(null); setEntries([]); setClosedWith(null); setIndex(0); setRatings({}); setReactions([]);
    setChat(welcome()); setMessage(""); played.current = false; closedStage.current = null;
    if (nextFormat !== format) void navigate({ search: nextFormat === "song" ? { format: "song" } : {} });
  }
  async function chooseFile(file: File | undefined) {
    if (!file || !isUpload || (mine && !mine.demo)) return;
    const typeError = validateAudioFile(file, format);
    if (typeError) { setFileError(typeError); return; }
    const url = URL.createObjectURL(file);
    setChecking(true);
    const length = await audioLength(url);
    setChecking(false);
    const error = length === undefined ? "This file can't be played in your browser." : validateAudioFile(file, format, length);
    if (error) { URL.revokeObjectURL(url); setFileError(error); return; }
    setFileError(null); setMine({ name: file.name, url, seconds: length ?? PERFORMANCE_LIMIT });
  }
  function downloadBeat() {
    if (!winner) return;
    const blob = excerptWav(winner.seed, seconds(winner.duration), segStart, segEnd - segStart);
    if (!blob) { toast.error("The excerpt couldn't be prepared in this browser."); return; }
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${winner.title.replace(/\W+/g, "_")}_${winner.segment.replace(/[:–]/g, "-")}_60s.wav`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 4000);
  }
  function react(value: string) { setReactions((previous) => [...previous.slice(-7), value]); }
  const myRewardId = winner && battleId ? rewardId(battleId, winner.id) : "";
  const myReward = vault.list.find((r) => r.id === myRewardId && r.artistId === me.id);
  // Award once when an eligible Creation Battle ends with you in first place; the id makes it idempotent.
  useEffect(() => {
    if (name !== "Results" || !winner || !battleId || !qualifiesForReward(format, winner, results[0]?.id, me.id)) return;
    vault.award({ id: rewardId(battleId, winner.id), battleId, battleName: "Artist Quick Battle #2042", artistId: me.id, beatId: winner.id, beatTitle: winner.title, producer: winner.producer, awardedAt: new Date().toISOString(), status: "awarded", seed: winner.seed, seconds: seconds(winner.duration) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, battleId, winner?.id, results[0]?.id]);

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
    const timeout = setTimeout(() => go(1), 800);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, ready]);
  // The countdown runs on its own; audio preview or download never touches it.
  useEffect(() => {
    if (!timed(name) || left <= 0) return;
    const timeout = setTimeout(() => setLeft((value) => Math.max(0, value - (demo ? DEMO_SPEED : 1))), 1000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, left, demo]);
  useEffect(() => {
    if (isUpload || left !== 0 || !timed(name)) return;
    advance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, stage, vote]);
  // Single upload close: everyone submitted early, or the window expired.
  useEffect(() => {
    if (isUpload && shouldCloseUpload(submitted.length, left)) closeUpload(submitted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUpload, submitted.length, left]);
  useEffect(() => {
    if (lastStage.current !== stage) { player.pause(); lastStage.current = stage; }
    if (name !== "Listen & Judge" || !submission) return;
    played.current = false;
    player.play(submission);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, index]);
  useEffect(() => {
    if (name !== "Listen & Judge" || player.track?.id !== submission?.id) return;
    if (player.playing) played.current = true;
    if (played.current && !player.playing && player.time >= player.duration - 0.3) nextEntry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, player.time, player.playing, player.track?.id]);
  useEffect(() => {
    if (name !== "Listen & Judge" || !demo) return;
    const timeout = setTimeout(nextEntry, PERFORMANCE_LIMIT / DEMO_SPEED * 1000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, index, demo]);
  useEffect(() => {
    if (name !== "Listen & Judge") return;
    const interval = setInterval(() => {
      setChat((previous) => [...previous.slice(-25), { who: ARTIST_ROSTER[1 + Math.floor(Math.random() * 7)], text: demoChat[Math.floor(Math.random() * demoChat.length)], simulated: true }]);
      react(emoji[Math.floor(Math.random() * emoji.length)]);
    }, 1800);
    return () => clearInterval(interval);
  }, [name]);

  const previewing = !!beatTrack && player.isCurrent(beatTrack.id);
  const beatCard = winner && beatTrack && <Panel className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="flex items-center gap-1.5 rounded-full bg-teal/10 px-3 py-1 text-xs font-semibold text-teal"><CheckCircle2 className="h-3.5 w-3.5" />Voting complete · {winnerVotes} of {ballot?.total} votes · {ballotLabel(winnerVotes, ballot?.total ?? 8)}</span>{winner.giveaway && <span className="flex items-center gap-1 text-xs font-semibold text-gold"><Gift className="h-3.5 w-3.5" />Giveaway eligible</span>}</div>
    <div className="flex items-center gap-4"><div className="h-20 w-20 shrink-0 rounded-xl" style={{ background: `radial-gradient(circle at 30% 30%, var(--gold), var(--violet) 60%, var(--surface))` }} aria-hidden /><div className="min-w-0"><p className="text-xs text-muted-foreground">Winning instrumental</p><h3 className="truncate text-2xl font-bold">{winner.title}</h3><p className="text-sm text-muted-foreground">Produced by {byId(winner.producer).name}</p><p className="text-sm text-teal">Excerpt: {winner.segment} · 60 seconds</p></div></div>
    <div className="rounded-lg bg-surface p-4"><p className="flex items-center justify-between font-semibold">Your challenge<Sparkles className="h-4 w-4 text-teal" /></p><p className="mt-1">{PROMPT}</p></div>
    <div className="grid gap-3 sm:grid-cols-2"><Button size="lg" onClick={downloadBeat}><Download />Download 60s Beat</Button><Button size="lg" variant="outline" aria-pressed={previewing} onClick={() => previewing ? player.pause() : player.play(beatTrack)}>{previewing ? <Pause /> : <Play />}{previewing ? "Pause Preview" : "Preview Beat"}</Button></div>
    <Waveform seed={winner.seed} bars={60} progress={player.track?.id === beatTrack.id ? player.time / PERFORMANCE_LIMIT : 0} className="h-10" />
    <p className="text-xs text-muted-foreground">Preview and download are cut from the same rendered audio ({winner.segment}), so you hear exactly what you download. Synthesized demo audio · competition use only · no ownership or commercial license of the full beat.</p>
  </Panel>;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-xs font-semibold tracking-widest text-coral">PHASE 1 DEMO · ROOM #2042</p><h1 className="text-3xl font-bold md:text-4xl">Artist Quick Battle</h1><p className="text-sm text-violet">{FORMAT_LABEL[format]}</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 rounded-full border bg-surface px-3 py-1.5 text-sm"><Switch checked={demo} onCheckedChange={setDemo} aria-label="Demo mode" />Demo Mode {demo && <span className="text-xs text-gold">30×</span>}</label>
        {stage < stages.length - 1 && <Button onClick={() => name === "Listen & Judge" ? nextEntry() : advance()}><FastForward />Skip</Button>}
        <Button variant="outline" size="icon" title="Restart demo" aria-label="Restart" onClick={() => restart()}><RotateCcw /></Button>
      </div>
    </div>
    <ol className="no-scrollbar flex gap-2 overflow-x-auto" aria-label="Battle stages">{stages.map((label, i) => <li key={label} aria-current={stage === i ? "step" : undefined} className={cn("flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-xs", i === stage ? "border-violet bg-violet/15 text-violet" : i < stage ? "text-teal" : "text-muted-foreground")}>{i < stage ? <Check className="h-3 w-3" /> : i + 1}{label}</li>)}</ol>
    <p className="text-xs text-muted-foreground">Frontend demo · all other participants, votes, submissions and rewards are simulated. Your file stays on this device.</p>

    {name === "Waiting Room" && <section>
      <div className="mb-4 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Battle format">{(["creation", "song"] as const).map((value) => <button key={value} role="radio" aria-checked={format === value} onClick={() => restart(value)} className={cn("rounded-xl border p-4 text-left", format === value ? "border-violet bg-violet/10" : "hover:border-violet/50")}><p className="font-semibold">{FORMAT_LABEL[value]}</p><p className="text-xs text-muted-foreground">{value === "creation" ? "Crate draw · beat vote · 15 min to create · 60s entry · 3 min upload" : "Finished songs · 3 min upload · no beat draw or creation timer"}</p></button>)}</div>
      <h2 className="text-xl font-bold">Waiting Room</h2><p className="text-sm text-muted-foreground">All eight artists must be ready.</p><BattleParticipants roster={ARTIST_ROSTER} ready={ready} />
      <label className="mt-4 flex items-center gap-2 text-sm"><Switch checked={oneMisses} onCheckedChange={setOneMisses} aria-label="Simulate a missed deadline" />Simulate one artist missing the upload deadline</label>
      <Button className="mt-5 w-full" disabled={ready.includes(me.id)} onClick={() => setReady((previous) => [...previous, me.id])}>{ready.includes(me.id) ? `Ready! (${ready.length}/8)` : "Ready Up"}</Button>
    </section>}

    {name === "Crate Draw" && <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4"><h2 className="text-xl font-bold">The Crate Draw</h2><BattleCountdown label="Ballot closes in" left={left} /></div>
      <p className="text-sm text-muted-foreground">Four eligible instrumentals from The Crate · anonymous 30-second previews · one vote per artist.</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{choices.map((beat, i) => <Panel key={beat.id} className={cn("space-y-3", vote === beat.id && "border-violet")}><AudioEmbed track={{ id: `blind-${beat.id}`, title: `Instrumental ${String.fromCharCode(65 + i)}`, artist: "Anonymous Crate preview", seed: beat.seed }} /><Button className="w-full" variant={vote === beat.id ? "default" : "outline"} aria-pressed={vote === beat.id} onClick={() => setVote(beat.id)}><Vote />{vote === beat.id ? "Your vote" : `Vote ${String.fromCharCode(65 + i)}`}</Button></Panel>)}</div>
      <p className="text-xs text-muted-foreground">Simulated ballots: Nova Rae → A, Lyric K → B, Mia Soul → B, Lexi Vibes → C, Verse → C, Amira → D, Juno → A. Your vote is the eighth ballot. Ties use a seeded random draw among tied choices (room seed {BALLOT_SEED}); restarting this room repeats the same draw.</p>
      <p className="text-xs text-muted-foreground">If time runs out before you vote, the ballot closes with the seven votes cast and the same tie rule.</p>
      <Button disabled={!vote} onClick={advance}>Close Ballot</Button>
    </section>}

    {name === "15-Minute Creation" && ballot && winner && <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">{ballot.counts.map((row, i) => <Panel key={row.beat.id} className={cn("space-y-1 p-3", row.beat.id === winner.id && "border-gold")}><p className="text-xs">Instrumental {String.fromCharCode(65 + i)}</p><p className="text-lg font-bold text-gold">{row.count} votes</p><p className="text-[11px] text-muted-foreground">{ballot.simulated.filter((v) => v.beatId === row.beat.id).length} simulated{vote === row.beat.id ? " + your vote" : ""}</p></Panel>)}</div>
      <p className="text-xs text-muted-foreground">{ballot.total}/8 ballots counted{vote ? "" : " (you didn't vote before the ballot closed)"}.{ballot.tied ? ` Tie resolved by the seeded random tiebreaker (${BALLOT_SEED}).` : ` ${ballotLabel(winnerVotes, ballot.total)}.`} Creation started automatically for all eight artists.</p>
      {beatCard}
      <div className="text-center"><BattleCountdown label="Time remaining" left={left} urgent /><div className="mt-2 h-2 overflow-hidden rounded-full bg-surface"><div className="h-full bg-violet transition-all" style={{ width: `${(left / 900) * 100}%` }} /></div><p className="mt-2 text-sm text-muted-foreground">Create your 60-second performance before the timer expires.</p></div>
      <label className="block space-y-2"><span className="text-sm text-muted-foreground">Your writing draft</span><textarea value={lyrics} onChange={(e) => setLyrics(e.target.value)} aria-label="Writing draft" rows={5} className="w-full rounded-lg border bg-surface p-3 text-sm outline-none focus:border-violet" /></label>
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">{ARTIST_ROSTER.map((id, i) => <div key={id} className="flex flex-col items-center gap-1"><Avatar id={id} /><span className="text-[10px] text-muted-foreground">{id === me.id ? "You" : ["writing", "recording", "rehearsing"][(i + Math.floor(left / 30)) % 3]}</span></div>)}</div>
    </section>}

    {isUpload && <section className="space-y-4">
      {format === "creation" && winner && <p className="text-sm text-muted-foreground">{winner.title} · {byId(winner.producer).name} · {winner.segment} · {PROMPT}</p>}
      <div className="flex flex-wrap items-end justify-between gap-4"><BattleCountdown label="Upload window closes in" left={left} urgent /><div className="min-w-[200px] flex-1"><p className="flex justify-between text-sm"><span>{format === "song" ? "Songs submitted" : "Performances submitted"}</span><strong aria-live="polite">{submitted.length} of 8 Submitted</strong></p><div className="mt-2 h-2 overflow-hidden rounded-full bg-surface"><div className="h-full bg-violet transition-all" style={{ width: `${(submitted.length / 8) * 100}%` }} /></div></div></div>
      <p className="text-xs text-muted-foreground">Everyone shares the same 3:00 window. When all eight valid entries are in, the room moves straight to Listen & Judge; if time runs out, missing entries are excluded.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{ARTIST_ROSTER.map((id) => { const status = id === me.id ? (mine ? (mine.demo ? "Submitted (demo)" : "Submitted") : checking ? "Uploading" : "Waiting") : uploadStatus(schedule[id], elapsed, false); return <div key={id} className={cn("flex items-center gap-2 rounded-lg border p-2", status.startsWith("Submitted") && "border-teal/60")}><Avatar id={id} size={28} /><div className="min-w-0"><p className="truncate text-xs font-semibold">{id === me.id ? "You" : byId(id).name}</p><p className={cn("text-[11px]", status.startsWith("Submitted") ? "text-teal" : status === "Uploading" ? "text-gold" : "text-muted-foreground")}>{status}</p></div></div>; })}</div>
      {mine && <Panel className="flex items-center gap-3 border-teal/60"><CheckCircle2 className="h-6 w-6 shrink-0 text-teal" /><div className="min-w-0"><p className="font-semibold">Submitted: <span className="break-all">{mine.demo ? "Blaze — Demo Entry" : mine.name}</span>{mine.demo && <span className="ml-2 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] text-gold">DEMO</span>}</p><p className="text-xs text-muted-foreground">{mine.demo ? "Simulated audio · no actual file uploaded · replace it with a real file until the window closes" : `${fmt(mine.seconds)} · kept on this device · waiting for the other artists`}</p></div></Panel>}
      {demo && !mine && <div className="flex flex-wrap items-center gap-3"><Button variant="outline" onClick={() => setMine({ name: "Demo Entry", url: "", seconds: PERFORMANCE_LIMIT, demo: true })}>Use Demo Submission</Button><span className="text-xs text-muted-foreground">Demo Mode: with no file uploaded, a labeled simulated entry is used for you when the window closes.</span></div>}
      {(!mine || mine.demo) && <label onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void chooseFile(e.dataTransfer.files[0]); }} className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 text-center"><Upload className="h-8 w-8 text-violet" /><span>{checking ? "Checking file…" : format === "song" ? "Choose or drop your finished song" : "Choose or drop your performance"}</span><span className="text-xs text-muted-foreground">WAV / MP3 / M4A / AAC / OGG / FLAC{format === "creation" ? " · 60 seconds maximum" : " · full-length songs allowed"}</span><input aria-label={format === "song" ? "Song file" : "Artist performance"} className="sr-only" type="file" accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.flac" onChange={(e) => { void chooseFile(e.target.files?.[0]); e.target.value = ""; }} /></label>}
      {fileError && <p role="alert" className="text-sm text-coral">{fileError}</p>}
    </section>}

    {name === "Listen & Judge" && submission && <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-4"><h2 className="text-xl font-bold">Listen & Judge</h2><p className="text-xs text-muted-foreground">Entry {index + 1} of {entries.length} valid submissions · same order for every judge · {demo ? "30× sequence: next entry every 2 seconds" : "each entry plays in full"}{missing.length > 0 && ` · ${missing.length} missed the deadline and are not judged`}</p><div className="flex items-center gap-3"><Avatar id={currentId} size={56} /><h3 className="min-w-0 break-words text-xl font-bold">{submission.title}</h3></div><div className="flex items-center gap-3"><PlayButton track={submission} /><Waveform seed={submission.seed} bars={60} progress={player.track?.id === submission.id ? player.time / (player.duration || 1) : 0} className="h-12" /></div><BattleRating own={!canRate(currentId, me.id)} value={ratings[rosterIndex]} onChange={(score) => setRatings((previous) => ({ ...previous, [rosterIndex]: score }))} /><div className="flex flex-wrap gap-2">{emoji.map((value) => <Button key={value} variant="outline" size="icon" aria-label={`React ${value}`} onClick={() => react(value)}>{value}</Button>)}</div><div aria-live="polite" className="flex h-8 gap-2 text-xl">{reactions.map((value, i) => <span key={i}>{value}</span>)}</div><Button variant="outline" onClick={nextEntry}>Next Submission</Button></div>
      <div className="flex h-96 flex-col border-l pl-4"><h3 className="mb-3 font-semibold">Live Chat · Demo</h3><div className="flex-1 space-y-2 overflow-y-auto text-sm" aria-live="polite">{chat.map((line, i) => <p key={i}><span className="font-semibold text-violet">{line.who === me.id ? "You" : byId(line.who).name}</span>{line.simulated && <span className="text-[10px] text-muted-foreground"> (simulated)</span>}: {line.text}</p>)}</div><form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!message.trim()) return; setChat((previous) => [...previous, { who: me.id, text: message, simulated: false }]); setMessage(""); }}><input aria-label="Chat message" placeholder="Say something…" value={message} onChange={(e) => setMessage(e.target.value)} className="min-w-0 flex-1 rounded-lg border bg-surface px-3 text-sm" /><Button aria-label="Send" size="icon"><Send /></Button></form></div>
    </section>}

    {name === "Results" && <section className="space-y-5"><h2 className="flex items-center gap-2 text-2xl font-bold"><Trophy className="text-gold" />Final Results · {FORMAT_LABEL[format]}</h2>
      <p className="text-xs text-muted-foreground">{closedWith ? `Uploads closed early with ${fmt(closedWith)} left — all eight submitted. ` : "Upload window ran to 0:00. "}Simulated judge averages plus your ratings · fictional demonstration XP</p>
      {results.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-sm">No valid submissions arrived before the deadline, so nothing was judged and no placements or XP were given.</p>
        : <ol className="divide-y rounded-lg border">{results.map((result, i) => <li key={result.id} className={cn("flex items-center gap-3 p-3", result.id === me.id && "bg-violet/10")}><span className="w-4 font-bold text-muted-foreground">{i + 1}</span><Avatar id={result.id} size={32} /><span className="min-w-0 flex-1 truncate text-sm">{result.id === me.id ? "You (Blaze)" : byId(result.id).name}</span><span className="text-sm text-gold">{result.avg.toFixed(2)}★</span><span className="text-xs text-teal">+{XP[i]} XP (demo)</span></li>)}</ol>}
      {missing.length > 0 && <p className="text-sm text-muted-foreground">Missed deadline · not scored: {missing.map((id) => id === me.id ? "You" : byId(id).name).join(", ")}</p>}
      {format === "creation" && winner && <div className="space-y-2 border-y py-4"><p className="text-sm">Producer credit: <strong>{byId(winner.producer).name}</strong> · {winner.title}</p>{winner.giveaway && results[0] && !myReward && <p className="flex items-center gap-2 font-semibold text-gold"><Gift />Simulated Beat Gift: {byId(results[0].id).name}</p>}{!winner.giveaway && <p className="text-xs text-muted-foreground">Competition Only beat · no instrumental is awarded.</p>}<p className="text-xs text-muted-foreground">No real license is issued in Phase 1. XP and rewards do not affect accounts.</p></div>}
      {myReward && <Panel className="space-y-3 border-gold/60"><p className="flex items-center gap-2 text-lg font-bold text-gold"><Gift />You won the full instrumental: {myReward.beatTitle}</p><p className="text-sm text-muted-foreground">Produced by {byId(myReward.producer).name} · {myReward.status === "claimed" ? "Claimed" : "Awarded — Awaiting Claim"} · reserved for you and removed from future draws and purchases.</p><div className="flex flex-wrap gap-2"><Button onClick={async () => { if (await downloadRewardFile(myReward, me.id)) vault.claim(myReward.id, me.id); else toast.error("The full beat couldn't be prepared in this browser."); }}><Download />{myReward.status === "claimed" ? "Re-download Full Beat" : "Claim & Download Full Beat"}</Button><Button asChild variant="outline"><a href="/profile?tab=vault">View in My Beat Vault</a></Button></div><p className="text-xs text-muted-foreground">Phase 1 simulation: the full-length demo audio your 60s excerpt was cut from. No ownership, exclusive rights or commercial license. Saved in this browser only.</p></Panel>}
      <Button onClick={() => restart()}>Run it back</Button></section>}
  </div>;
}
