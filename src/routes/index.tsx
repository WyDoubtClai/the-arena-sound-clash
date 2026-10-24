import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ChevronLeft, ChevronRight, Disc3, Heart, MessageCircle, Radio, Sparkles, Star, Swords, Trophy, Users, Zap } from "lucide-react";
import { useRef } from "react";
import hero from "@/assets/hero-battle.jpg";
import { activity, beats, byId, events, people, posts } from "@/lib/data";
import { Avatar, Panel, PlayButton, RoleBadge, Section, Waveform } from "@/components/arena/bits";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "The Arena — Create, Compete & Discover Music" },
      { name: "description", content: "A competitive music platform and community: 15-minute artist and producer battles, a shared beat Crate, rankings and The Lobby." },
      { property: "og:title", content: "The Arena — 15 Minutes. Make It Yours." },
      { property: "og:description", content: "Artists, producers and fans create, compete, discover music and build their reputations." },
    ],
  }),
  component: Home,
});

// Mirrors The Crate's demo listing labels (prototype only, no real sales).
type Listing = "Competition Only" | "Winner Giveaway" | "For Sale" | "Buy It or Win It";
const LISTING: Record<Listing, { cls: string; eligible: boolean }> = {
  "Competition Only": { cls: "border-violet/50 bg-violet/15 text-violet", eligible: true },
  "Winner Giveaway": { cls: "border-gold/50 bg-gold/15 text-gold", eligible: true },
  "For Sale": { cls: "border-teal/50 bg-teal/15 text-teal", eligible: false },
  "Buy It or Win It": { cls: "border-coral/50 bg-coral/15 text-coral", eligible: true },
};
const listingFor = (b: (typeof beats)[number]): Listing =>
  b.giveaway ? (b.seed % 2 === 0 ? "Buy It or Win It" : "Winner Giveaway") : b.seed % 2 === 0 ? "For Sale" : "Competition Only";

// One featured beat per listing type, so all four labels are shown.
const featured = (Object.keys(LISTING) as Listing[]).map((l) => beats.find((b) => listingFor(b) === l)).filter(Boolean) as typeof beats;

const modes = [
  { icon: Disc3, color: "coral", title: "Artist Quick Battle", line: "8 artists · 4 randomly drawn beats · vote for one shared instrumental · 15 minutes to create.", cta: "Enter Artist Battle", to: "/artist-quick-battle" as const },
  { icon: Zap, color: "violet", title: "Producer Gauntlet", line: "8 producers · one shared sample kit · 15 minutes to cook up a beat · live judging.", cta: "Enter the Gauntlet", to: "/gauntlet" as const },
  { icon: Users, color: "teal", title: "Custom Battles", line: "Host your own 1v1 or group competitions with finished songs or original creations.", cta: "See battle formats", to: "/compete" as const },
];

const DemoTag = () => <span className="rounded border border-gold/40 bg-gold/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold">Demo data</span>;

function Home() {
  const slider = useRef<HTMLDivElement>(null);
  const scroll = (d: number) => slider.current?.scrollBy({ left: d * 300, behavior: "smooth" });
  const topBy = (role: string) => [...people].filter((p) => p.role === role).sort((a, b) => b.xp - a.xp)[0];
  const topRep = [...people].sort((a, b) => b.rep - a.rep)[0];
  const leaders = [
    { label: "Top Artist", sub: "Competitive XP", p: topBy("Artist"), val: (x: (typeof people)[number]) => `${x.xp.toLocaleString()} XP`, icon: Trophy, color: "coral" },
    { label: "Top Producer", sub: "Competitive XP", p: topBy("Producer"), val: (x: (typeof people)[number]) => `${x.xp.toLocaleString()} XP`, icon: Zap, color: "violet" },
    { label: "Community Pillar", sub: "Reputation (separate from XP)", p: topRep, val: (x: (typeof people)[number]) => `${x.rep} rep`, icon: Star, color: "teal" },
  ];

  return (
    <div className="space-y-12">
      {/* Ticker */}
      <div className="flex items-center gap-3 overflow-hidden rounded-full border bg-surface py-2 pl-3" aria-label="Sample activity (demo data)">
        <DemoTag />
        <div className="overflow-hidden">
          <div className="animate-ticker flex w-max gap-10 whitespace-nowrap px-4 text-sm text-muted-foreground">
            {[...activity, ...activity].map((a, i) => <span key={i}>{a}</span>)}
          </div>
        </div>
      </div>

      {/* Hero */}
      <section className="relative isolate overflow-hidden rounded-3xl border">
        <img src={hero} alt="Two artists facing off on a neon stage" width={1600} height={800} className="absolute inset-0 -z-10 h-full w-full object-cover opacity-70" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/80 to-background/10" />
        <div className="absolute -left-24 -top-24 -z-10 h-72 w-72 rounded-full bg-violet/30 blur-3xl" />
        <div className="absolute -bottom-24 right-10 -z-10 h-72 w-72 rounded-full bg-coral/25 blur-3xl" />
        <div className="max-w-2xl p-6 py-12 md:p-14">
          <span className="inline-flex items-center gap-2 rounded-md border border-coral/50 bg-coral/15 px-2 py-1 text-xs font-bold text-coral"><Radio className="h-3 w-3" /> FEATURED · FRIDAY NIGHT SONG BATTLE (PREVIEW)</span>
          <h1 className="mt-5 font-display text-5xl font-bold leading-[0.95] tracking-tight md:text-7xl">
            15 Minutes.<br /><span className="bg-gradient-to-r from-violet via-coral to-gold bg-clip-text text-transparent">Make It Yours.</span>
          </h1>
          <p className="mt-5 max-w-lg text-base text-muted-foreground md:text-lg">The Arena is where artists, producers and fans create, compete, discover music and build their reputations — one timed battle at a time.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/compete" className="inline-flex items-center gap-2 rounded-xl bg-coral px-6 py-3 text-sm font-semibold text-primary-foreground glow-coral transition hover:-translate-y-0.5"><Swords className="h-4 w-4" /> Enter a Battle</Link>
            <Link to="/discover" className="inline-flex items-center gap-2 rounded-xl border bg-background/60 px-6 py-3 text-sm font-semibold backdrop-blur transition hover:border-violet">Explore The Arena <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>

      {/* Battle modes */}
      <Section title="Three Ways to Battle" action={<Link to="/compete" className="text-xs text-violet">All formats</Link>}>
        <div className="grid gap-4 md:grid-cols-3">
          {modes.map((m) => (
            <Link key={m.title} to={m.to} className={`group relative flex flex-col gap-4 overflow-hidden rounded-2xl border bg-surface p-6 transition hover:-translate-y-1 hover:border-violet`}>
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full blur-2xl opacity-40 transition group-hover:opacity-70" style={{ background: `var(--${m.color})` }} />
              <div className="grid h-12 w-12 place-items-center rounded-xl" style={{ background: `color-mix(in oklab, var(--${m.color}) 18%, transparent)`, color: `var(--${m.color})` }}><m.icon className="h-6 w-6" /></div>
              <h3 className="font-display text-xl font-bold">{m.title}</h3>
              <p className="flex-1 text-sm text-muted-foreground">{m.line}</p>
              <span className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: `var(--${m.color})` }}>{m.cta} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
            </Link>
          ))}
        </div>
      </Section>

      {/* Featured Crate */}
      <Section title="Featured in The Crate" action={<Link to="/crate" className="text-xs text-violet">Open the full Crate</Link>}>
        <p className="text-xs text-muted-foreground">Sample listings for the prototype. Only Competition Only, Winner Giveaway and Buy It or Win It beats can be drawn into battles; For Sale beats are not battle-eligible.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((b) => {
            const pr = byId(b.producer);
            const l = listingFor(b);
            return (
              <div key={b.id} className="group overflow-hidden rounded-2xl border bg-surface transition hover:-translate-y-1 hover:border-violet">
                <div className="relative h-32 p-3" style={{ background: `radial-gradient(circle at 30% 30%, hsl(${pr.hue} 80% 55% / .55), transparent 65%), var(--surface-2)` }}>
                  <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${LISTING[l].cls}`}>{l}</span>
                  <div className="absolute bottom-3 right-3"><PlayButton track={{ id: b.id, title: b.title, artist: pr.name, seed: b.seed }} /></div>
                  <Waveform seed={b.seed} bars={32} className="absolute bottom-3 left-3 right-16 h-8 opacity-70" />
                </div>
                <div className="space-y-1 p-4">
                  <p className="truncate font-display font-semibold">{b.title}</p>
                  <p className="flex items-center gap-2 text-xs text-muted-foreground"><Avatar id={pr.id} size={18} />{pr.name} · {b.bpm} BPM · {b.key}</p>
                  <p className={`text-[11px] ${LISTING[l].eligible ? "text-teal" : "text-muted-foreground"}`}>{LISTING[l].eligible ? "Battle-eligible" : "Not battle-eligible"}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Rankings preview */}
      <Section title="Rise Through The Arena" action={<Link to="/rankings" className="text-xs text-violet">View rankings</Link>}>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><DemoTag /> XP comes from competing; reputation comes from helping the community. They are tracked separately.</div>
        <div className="grid gap-4 md:grid-cols-3">
          {leaders.map(({ label, sub, p, val, icon: Icon, color }) => p && (
            <Link key={label} to="/rankings" className="flex items-center gap-4 rounded-2xl border bg-surface p-5 transition hover:border-gold">
              <Avatar id={p.id} size={56} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide" style={{ color: `var(--${color})` }}><Icon className="h-3.5 w-3.5" />{label}</p>
                <p className="truncate font-display text-lg font-bold">{p.name}</p>
                <p className="text-xs text-muted-foreground">{val(p)} · {sub}</p>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      {/* Upcoming slider (existing) */}
      <Section title="Upcoming Battles" action={
        <div className="flex gap-2">
          <button aria-label="Previous" onClick={() => scroll(-1)} className="grid h-8 w-8 place-items-center rounded-full border bg-surface"><ChevronLeft className="h-4 w-4" /></button>
          <button aria-label="Next" onClick={() => scroll(1)} className="grid h-8 w-8 place-items-center rounded-full border bg-surface"><ChevronRight className="h-4 w-4" /></button>
        </div>
      }>
        <div ref={slider} className="no-scrollbar flex snap-x gap-4 overflow-x-auto">
          {events.map((e, i) => (
            <Link to="/events" key={e.id} className="w-72 shrink-0 snap-start rounded-2xl border bg-surface p-4 transition hover:border-violet">
              <div className="h-24 rounded-xl" style={{ background: `linear-gradient(135deg, var(--${["violet", "coral", "teal", "gold", "violet"][i % 5]}), var(--surface-2))` }} />
              <p className="mt-3 font-display font-semibold">{e.title}</p>
              <p className="text-xs text-muted-foreground">{e.meta}</p>
              <p className="mt-2 text-xs text-gold">Starts in {e.inHours}h (sample)</p>
            </Link>
          ))}
        </div>
      </Section>

      {/* Community */}
      <section className="grid gap-6 rounded-3xl border bg-gradient-to-br from-teal/10 via-surface to-violet/10 p-6 md:p-10 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-teal"><Sparkles className="h-4 w-4" /> The Lobby</span>
          <h2 className="font-display text-3xl font-bold md:text-4xl">More than a battle.<br />A community.</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Find collaborators — artists, producers and engineers.</li>
            <li>• Get feedback on works in progress.</li>
            <li>• Discover new music and rising creators.</li>
            <li>• Fans take part by listening, reacting and judging.</li>
          </ul>
          <div className="flex flex-wrap gap-3">
            <Link to="/lobby" className="rounded-lg bg-teal px-5 py-2.5 text-sm font-semibold text-primary-foreground">Visit The Lobby</Link>
            <Link to="/discover" className="rounded-lg border bg-background/60 px-5 py-2.5 text-sm font-semibold">Discover music</Link>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between"><p className="text-sm font-semibold">Trending posts</p><DemoTag /></div>
          <Panel className="space-y-2 bg-background/40">
            {posts.slice(0, 4).map((p) => (
              <Link to="/lobby" key={p.id} className="flex gap-3 rounded-lg p-2 transition hover:bg-accent">
                <Avatar id={p.author} size={32} />
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-xs"><b>{byId(p.author).name}</b><RoleBadge role={byId(p.author).role} /></p>
                  <p className="line-clamp-1 text-sm">{p.body}</p>
                  <p className="flex gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Heart className="h-3 w-3" />{p.likes}</span><span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{p.comments}</span><span>{p.time}</span></p>
                </div>
              </Link>
            ))}
          </Panel>
        </div>
      </section>

      {/* Closing CTA */}
      <Panel className="flex flex-wrap items-center justify-between gap-4 border-violet/40 bg-gradient-to-r from-violet/20 to-coral/10">
        <div className="flex items-center gap-3"><Users className="h-6 w-6 text-teal" /><p className="text-sm">Prototype preview — multiplayer rooms and live counts are not active yet.</p></div>
        <Link to="/compete" className="rounded-lg bg-coral px-4 py-2 text-sm font-semibold text-primary-foreground glow-coral">Try a demo battle</Link>
      </Panel>
    </div>
  );
}
