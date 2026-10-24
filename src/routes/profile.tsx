import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, Crown, Disc3, Flame, Heart, LockKeyhole, MapPin, MessageSquare, Share2, Star, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { beats, byId, tracks } from "@/lib/data";
import { usePlayer } from "@/lib/player";
import { achievementList, canEditProfile, canFeatureAchievement, competitive, crateMetrics, earnedAchievements, isCompetitionEligible, matchHistory, profileIds, profileListing, profileRoles, winPercentage, type ProfileId } from "@/lib/profile-demo";
import { Avatar, Panel, Pills, PlayButton, RoleBadge, Waveform } from "@/components/arena/bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import banner from "@/assets/studio-banner.jpg";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
    { title: "Player Profiles — The Arena" },
    { name: "description", content: "Explore demo musician and judge profiles, music, competitive match history, featured trophies and community reputation." },
    { property: "og:title", content: "Player Profiles — The Arena" },
    { property: "og:description", content: "Music meets competition: demo artist, producer and judge identities with distinct records and achievements." },
  ] }),
  component: Profile,
});

const tabs = ["Music", "Battles", "Achievements"] as const;
const icons = { trophy: Trophy, flame: Flame, crown: Crown, disc: Disc3, heart: Heart };
const listingStyle = {
  "Competition Only": "border-violet/50 bg-violet/15 text-violet",
  "Winner Giveaway": "border-gold/50 bg-gold/15 text-gold",
  "For Sale": "border-teal/50 bg-teal/15 text-teal",
  "Buy It or Win It": "border-coral/50 bg-coral/15 text-coral",
};
const initialBios: Record<ProfileId, string> = {
  blaze: "Making music. Competing. Building. Open to collabs.",
  tonemadelt: "Drums with intent. Instrumentals with soul. Open to collabs.",
  judgeraye: "Listening closely. Giving thoughtful feedback. Celebrating the craft.",
};

function Stats({ items }: { items: (readonly [string | number, string])[] }) {
  return <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-2">{items.map(([value, label]) => <div key={label} className="min-w-0"><dd className="font-display text-xl font-bold">{value}</dd><dt className="text-xs leading-5 text-muted-foreground">{label}</dt></div>)}</dl>;
}

function Record({ title, record, current, best, rank, xp, tournaments }: { title: string; record: readonly number[]; current: number; best: number; rank: string; xp: number; tournaments: number }) {
  const [wins, losses, draws] = record;
  return <Panel className="rounded-lg">
    <h2 className="mb-3 font-display font-semibold">{title}</h2>
    <div className="mb-4 grid grid-cols-3 border-b pb-3 text-center">
      {[[wins, "Wins", "text-teal"], [losses, "Losses", "text-coral"], [draws, "Draws", "text-gold"]].map(([n, label, cls]) => <div key={label}><p className={cn("font-display text-2xl font-bold", cls)}>{n}</p><p className="text-xs text-muted-foreground">{label}</p></div>)}
    </div>
    <Stats items={[[record.reduce((sum, n) => sum + n, 0), "Battles entered"], [`${winPercentage(record)}%`, "Win percentage"], [current, "Current win streak"], [best, "Best win streak"], [tournaments, "Tournament victories"], [rank, "Skill rank (demo)"], [xp.toLocaleString(), "Competition XP"]]} />
  </Panel>;
}

function Profile() {
  const [id, setId] = useState<ProfileId>("blaze");
  const [tab, setTab] = useState<(typeof tabs)[number]>("Music");
  const [featured, setFeatured] = useState<Record<ProfileId, string>>({ blaze: "streak", tonemadelt: "champion", judgeraye: "community" });
  const [bios, setBios] = useState(initialBios);
  const [name, setName] = useState("Blaze");
  const [city, setCity] = useState("Atlanta, GA");
  const [edit, setEdit] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftBio, setDraftBio] = useState(bios.blaze);
  const [draftCity, setDraftCity] = useState(city);
  const p = byId(id);
  const pl = usePlayer();
  const isJudge = id === "judgeraye";
  const own = canEditProfile(id);
  const comp = isJudge ? null : competitive[id];
  const crate = isJudge ? null : crateMetrics[id];
  const title = achievementList.find((a) => a.id === featured[id]);
  const TitleIcon = title ? icons[title.icon] : Trophy;
  const displayName = own ? name : p.name;
  const instrumentals = beats.filter((beat) => beat.producer === id);

  useEffect(() => {
    const target = new URLSearchParams(window.location.search).get("profile");
    if (profileIds.some((profile) => profile === target)) setId(target as ProfileId);
  }, []);

  async function share() {
    const url = new URL(window.location.href);
    url.searchParams.set("profile", id);
    try { await navigator.clipboard.writeText(url.toString()); toast.success("Profile preview link copied"); }
    catch { toast.error("Could not copy the link. Please copy the page address instead."); }
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Demo profile">
        {profileIds.map((profile) => <Button key={profile} variant="outline" size="sm" role="tab" aria-selected={id === profile} onClick={() => { setId(profile); setEdit(false); }} className={cn("rounded-full", id === profile && "border-violet text-violet")}>View {byId(profile).name}</Button>)}
      </div>
      <p className="text-xs text-muted-foreground">Demo profiles · All records and accomplishments are fictional</p>
    </div>

    <section className="overflow-hidden rounded-3xl border bg-surface" aria-label="Profile identity">
      <img src={banner} alt="" width={1600} height={608} className="h-36 w-full object-cover md:h-52" />
      <div className="flex flex-wrap items-end gap-4 px-5 pb-5">
        <div className="relative -mt-12"><Avatar id={p.id} size={112} ring /></div>
        <div className="min-w-0 flex-1 basis-64 pt-3">
          <h1 className="flex items-center gap-2 break-words text-3xl font-bold">{displayName}<BadgeCheck aria-label="Demo verification badge" className="h-6 w-6 shrink-0 text-violet" /></h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">{profileRoles[id].map((role) => <RoleBadge key={role} role={role} />)}<span className="rounded-md border border-gold/40 px-1.5 py-0.5 text-[10px] font-semibold text-gold">LEVEL {p.level}</span></div>
          <p className="mt-3 flex items-center gap-2 font-display text-sm font-semibold text-gold"><TitleIcon className="h-4 w-4 shrink-0" />{title?.title}<span className="font-sans text-[10px] font-normal text-muted-foreground">Demo title</span></p>
          <p className="mt-2 break-words text-sm text-muted-foreground">{bios[id]}</p>
          {(own || p.city) && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{own ? city : p.city}</p>}
        </div>
        <div className="flex gap-5 text-center">
          {[[p.followers, "Followers"], [isJudge ? "620" : "1.1K", "Following"], [isJudge ? "—" : "48.7K", "Plays"]].map(([v, k]) => <div key={k}><p className="font-display text-xl font-bold">{v}</p><p className="text-xs text-muted-foreground">{k}</p></div>)}
        </div>
        <div className="flex items-center gap-2">
          {own ? <Button variant="outline" size="sm" onClick={() => { setDraftName(name); setDraftBio(bios.blaze); setDraftCity(city); setEdit(true); }}>Edit Profile</Button> : <span className="text-xs text-muted-foreground">Visitor preview</span>}
          <Button variant="outline" size="icon" onClick={share} aria-label="Share profile" title="Copy profile preview link"><Share2 /></Button>
        </div>
      </div>
    </section>

    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-5">
        <Pills items={tabs} value={tab} onChange={setTab} />
        {tab === "Music" && <div className="space-y-6">
          {id === "blaze" && <section aria-label="Songs">
            <h2 className="mb-3 font-display text-lg font-semibold">Songs <span className="ml-2 text-xs font-normal text-muted-foreground">Demo discography</span></h2>
            <Panel className="space-y-4 rounded-lg">
              {tracks.slice(4).map((t) => <div key={t.id} className="flex items-center gap-3">
                <img src={banner} alt="" className="hidden h-12 w-12 rounded-md object-cover sm:block" />
                <PlayButton track={{ ...t, artist: displayName }} />
                <div className="min-w-0 flex-1 sm:max-w-40"><p className="truncate text-sm font-semibold">{t.title}</p><p className="truncate text-xs text-muted-foreground">{displayName} · {t.plays} plays</p></div>
                <Waveform seed={t.seed} bars={50} progress={pl.track?.id === t.id ? pl.time / pl.duration : 0} className="hidden h-8 sm:flex" onSeek={(progress) => { if (pl.track?.id === t.id) pl.seek(progress * pl.duration); }} />
                <div className="shrink-0 text-right text-xs text-muted-foreground"><p>{t.dur}</p><p className="mt-1 flex items-center justify-end gap-1 text-coral"><Heart className="h-3 w-3" />{t.likes}</p></div>
              </div>)}
            </Panel>
          </section>}
          {!isJudge && <section aria-label="Instrumentals">
            <div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-display text-lg font-semibold">Instrumentals</h2><Button asChild variant="link" size="sm"><Link to="/crate">The Crate →</Link></Button></div>
            {instrumentals.length > 0 ? <div className="space-y-3">{instrumentals.map((beat) => {
              const label = profileListing(beat);
              return <Panel key={beat.id} className="rounded-lg">
                <div className="flex items-center gap-3">
                  <img src={banner} alt="" className="hidden h-14 w-14 rounded-md object-cover sm:block" />
                  <PlayButton track={{ id: beat.id, title: beat.title, artist: p.name, seed: beat.seed }} />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{beat.title}</p><p className="text-xs text-muted-foreground">{p.name} · {beat.plays} plays</p></div>
                  <span className="shrink-0 text-xs text-muted-foreground">{beat.duration}</span>
                </div>
                <Waveform seed={beat.seed} bars={50} progress={pl.track?.id === beat.id ? pl.time / pl.duration : 0} className="mt-2 h-7" onSeek={(progress) => { if (pl.track?.id === beat.id) pl.seek(progress * pl.duration); }} />
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]"><span className={cn("rounded-md border px-2 py-1", listingStyle[label])}>{label}</span><span className="text-muted-foreground">{beat.genre} · {beat.bpm} BPM · {beat.key}</span><span className="text-muted-foreground">{isCompetitionEligible(label) ? "Competition eligible" : "Not competition eligible"} · Demo listing</span></div>
              </Panel>;
            })}</div> : <p className="border-y py-5 text-sm text-muted-foreground">No instrumentals in the current demo catalog. Historical Crate statistics are sample data.</p>}
          </section>}
          {isJudge && <section className="space-y-4" aria-label="Community participation">
            <div><h2 className="font-display text-lg font-semibold">Listening is a craft</h2><p className="mt-1 text-sm text-muted-foreground">Judge Raye · Demo community contributions</p></div>
            <Stats items={[[120, "Battles judged"], [84, "Thoughtful feedback notes"], [36, "Community posts"], [212, "Helpful reactions"]]} />
            <div className="space-y-3 border-y py-4">
              <p className="text-sm">“The vocal phrasing leaves room for the drums. Strong control of the pocket.”</p><p className="text-xs text-muted-foreground">Sample feedback · Friday Night Showdown</p>
              <p className="flex items-center gap-2 text-sm"><MessageSquare className="h-4 w-4 text-teal" />What makes feedback useful for an artist?</p><p className="text-xs text-muted-foreground">Sample discussion · 22 replies</p>
            </div>
            <Button asChild variant="outline"><Link to="/lobby">Visit The Lobby</Link></Button>
          </section>}
        </div>}

        {tab === "Battles" && <section aria-label="Match history">
          <div className="mb-3"><h2 className="font-display text-lg font-semibold">{isJudge ? "Judging history" : "Match history"}</h2><p className="text-xs text-muted-foreground">Sample matches · XP earned is illustrative, not a reward formula</p></div>
          <div className="divide-y rounded-lg border bg-surface px-4">{matchHistory[id].map((match) => <article key={match.name} className="flex flex-wrap items-center gap-3 py-4">
            <span className={cn("w-16 shrink-0 font-display text-sm font-bold", match.result === "Loss" ? "text-coral" : match.result === "Draw" ? "text-gold" : "text-teal")}>{match.result}</span>
            <div className="min-w-0 flex-1 basis-44"><h3 className="text-sm font-semibold">{match.name}</h3><p className="text-xs text-muted-foreground">{match.format} · {match.against}</p></div>
            <div className="text-xs text-muted-foreground"><p>{match.date}</p>{match.xp !== undefined && <p className="mt-1 text-violet">+{match.xp} competition XP</p>}</div>
          </article>)}</div>
        </section>}

        {tab === "Achievements" && <section aria-label="Achievements">
          <div className="mb-3"><h2 className="font-display text-lg font-semibold">Trophy room</h2><p className="text-xs text-muted-foreground">Fictional achievements · Showcase changes last for this session only</p></div>
          <div className="grid gap-3 sm:grid-cols-2">{achievementList.map((a) => {
            const Icon = icons[a.icon]; const earned = earnedAchievements[id].includes(a.id); const selected = featured[id] === a.id;
            return <article key={a.id} className={cn("flex gap-3 rounded-lg border bg-surface p-4", selected && "border-gold/60", !earned && "border-dashed")}>
              <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full", earned ? "bg-gold/15 text-gold" : "bg-muted text-muted-foreground")}><Icon className="h-6 w-6" /></div>
              <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">{a.title}</h3><p className="mt-1 text-xs text-muted-foreground">{a.detail}</p>
                {earned ? <Button variant="ghost" size="sm" className={cn("mt-2 h-7 px-0 text-xs", selected ? "text-gold" : "text-violet")} onClick={() => { if (canFeatureAchievement(id, a.id)) setFeatured((prev) => ({ ...prev, [id]: a.id })); }} aria-pressed={selected}><Star className="h-3 w-3" />{selected ? "Featured · Demo earned" : "Showcase · Demo earned"}</Button> : <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground"><LockKeyhole className="h-3 w-3" />Locked · Demo</p>}
              </div>
            </article>;
          })}</div>
        </section>}
      </div>

      <aside className="space-y-4" aria-label="Demo profile statistics">
        <Panel className="rounded-lg">
          <div className="flex flex-wrap justify-between gap-1 text-sm"><span className="font-semibold">Level {p.level}</span><span className="text-muted-foreground">{p.xp.toLocaleString()} / {(p.level * 1000).toLocaleString()} XP</span></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-violet to-coral" style={{ width: `${Math.min(100, (p.xp / (p.level * 1000)) * 100)}%` }} /></div>
          <p className="mt-2 text-[11px] text-muted-foreground">Demo progression · Not a skill or reputation score</p>
        </Panel>
        <Panel className="rounded-lg"><h2 className="text-sm font-semibold">Community reputation</h2><p className="mt-1 font-display text-3xl font-bold text-teal">{p.rep.toLocaleString()}</p><p className="text-xs text-muted-foreground">Demo community standing · Separate from competition XP</p></Panel>
        {comp && <>
          {id === "blaze" && <Record title="Artist Battle Record" record={p.record} current={comp.current} best={comp.best} tournaments={comp.tournaments} rank={comp.rank} xp={p.xp} />}
          <Record title="Producer Battle Record" record={comp.producerRecord} current={id === "blaze" ? 1 : comp.current} best={id === "blaze" ? 3 : comp.best} tournaments={id === "blaze" ? 0 : comp.tournaments} rank={comp.producerRank} xp={comp.producerXp} />
        </>}
        {crate && <Panel className="rounded-lg"><h2 className="mb-3 font-display font-semibold">The Crate Performance</h2><Stats items={[[crate.uploaded, "Beats uploaded"], [crate.voteAppearances, "Four-beat vote appearances"], [crate.selectionsWon, "Voting selections won"], [crate.battleUses, "Battles using beats"], [crate.artistWins, "Artist victories using beats"], [crate.gifts, "Giveaway beats awarded"], [crate.sold, "Beats sold (demo)"]]} /><p className="mt-3 text-[11px] text-muted-foreground">Separate sample measurements, not live catalog totals or real sales.</p></Panel>}
        {isJudge && <Panel className="rounded-lg"><h2 className="mb-3 font-display font-semibold">Community identity</h2><Stats items={[[120, "Battles judged"], [84, "Feedback notes"], [36, "Posts"]]} /><p className="mt-3 text-xs text-muted-foreground">Demo participation · No musician competition rank</p></Panel>}
        {!isJudge && <Button asChild variant="outline" className="w-full"><Link to="/rankings">View demo rankings</Link></Button>}
      </aside>
    </div>

    <Dialog open={edit && own} onOpenChange={setEdit}><DialogContent className="bg-surface"><DialogHeader><DialogTitle>Edit Profile</DialogTitle><DialogDescription>Demo edits apply only to this session. Nothing is saved or published.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (!own || !draftName.trim()) return; setName(draftName.trim()); setCity(draftCity.trim()); setBios((prev) => ({ ...prev, blaze: draftBio.trim() })); setEdit(false); toast.success("Demo profile updated for this session"); }}>
        <label className="block space-y-1 text-sm"><span>Display name</span><input required maxLength={40} value={draftName} onChange={(e) => setDraftName(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2" /></label>
        <label className="block space-y-1 text-sm"><span>Biography</span><textarea maxLength={180} rows={3} value={draftBio} onChange={(e) => setDraftBio(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2" /></label>
        <label className="block space-y-1 text-sm"><span>Location</span><input maxLength={60} value={draftCity} onChange={(e) => setDraftCity(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2" /></label>
        <Button type="submit" disabled={!draftName.trim()}>Apply demo changes</Button>
      </form>
    </DialogContent></Dialog>
  </div>;
}
