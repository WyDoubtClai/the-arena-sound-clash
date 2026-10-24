import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Heart, MessageCircle, Radio, Users } from "lucide-react";
import { useRef } from "react";
import hero from "@/assets/hero-battle.jpg";
import { activity, beats, byId, events, people, posts } from "@/lib/data";
import { Avatar, Panel, PlayButton, RoleBadge, Section } from "@/components/arena/bits";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Home — The Arena" },
      { name: "description", content: "Live Gauntlets, upcoming song battles, trending Lobby talk and rising Crate beats." },
      { property: "og:title", content: "Home — The Arena" },
      { property: "og:description", content: "Live Gauntlets, upcoming song battles, trending Lobby talk and rising Crate beats." },
    ],
  }),
  component: Home,
});

function Home() {
  const slider = useRef<HTMLDivElement>(null);
  const scroll = (d: number) => slider.current?.scrollBy({ left: d * 300, behavior: "smooth" });
  return (
    <div className="space-y-8">
      {/* Ticker */}
      <div className="overflow-hidden rounded-full border bg-surface py-2" aria-label="Live activity">
        <div className="animate-ticker flex w-max gap-10 whitespace-nowrap px-4 text-sm text-muted-foreground">
          {[...activity, ...activity].map((a, i) => <span key={i}>{a}</span>)}
        </div>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border">
        <img src={hero} alt="Two artists facing off on a neon stage" width={1600} height={800} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent" />
        <div className="relative max-w-xl p-6 md:p-10">
          <span className="inline-flex items-center gap-2 rounded-md bg-coral px-2 py-1 text-xs font-bold text-primary-foreground"><Radio className="h-3 w-3 animate-pulse" /> FEATURED · LIVE TONIGHT</span>
          <h1 className="mt-4 text-4xl font-bold italic leading-none md:text-6xl">FRIDAY NIGHT<br />SONG BATTLE</h1>
          <p className="mt-3 text-sm text-muted-foreground">8 Artists · Live Judging · 7PM EST · Gauntlet Producer Quick Battle opens right after</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/gauntlet" className="rounded-lg bg-violet px-5 py-2.5 text-sm font-semibold text-primary-foreground glow-violet">Enter the Gauntlet</Link>
            <Link to="/events" className="rounded-lg border bg-background/60 px-5 py-2.5 text-sm font-semibold">Watch Event</Link>
          </div>
        </div>
      </section>

      {/* Upcoming slider */}
      <Section title="Upcoming Battles" action={
        <div className="flex gap-2">
          <button aria-label="Previous" onClick={() => scroll(-1)} className="grid h-8 w-8 place-items-center rounded-full border bg-surface"><ChevronLeft className="h-4 w-4" /></button>
          <button aria-label="Next" onClick={() => scroll(1)} className="grid h-8 w-8 place-items-center rounded-full border bg-surface"><ChevronRight className="h-4 w-4" /></button>
        </div>
      }>
        <div ref={slider} className="no-scrollbar flex snap-x gap-4 overflow-x-auto">
          {events.map((e, i) => (
            <Link to="/events" key={e.id} className="w-72 shrink-0 snap-start rounded-2xl border bg-surface p-4 transition hover:border-violet">
              <div className="h-24 rounded-xl" style={{ background: `linear-gradient(135deg, var(--${["violet", "coral", "teal", "gold", "violet"][i]}), var(--surface-2))` }} />
              <p className="mt-3 font-display font-semibold">{e.title}</p>
              <p className="text-xs text-muted-foreground">{e.meta}</p>
              <p className="mt-2 text-xs text-gold">Starts in {e.inHours}h</p>
            </Link>
          ))}
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Trending in The Lobby" action={<Link to="/lobby" className="text-xs text-violet">See all</Link>}>
          <Panel className="space-y-3">
            {posts.slice(0, 4).map((p) => (
              <Link to="/lobby" key={p.id} className="flex gap-3 rounded-lg p-1 hover:bg-accent">
                <Avatar id={p.author} size={32} />
                <div className="min-w-0">
                  <p className="line-clamp-1 text-sm">{p.body}</p>
                  <p className="flex gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Heart className="h-3 w-3" />{p.likes}</span><span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{p.comments}</span><span>{p.time}</span></p>
                </div>
              </Link>
            ))}
          </Panel>
        </Section>

        <Section title="Featured Artists & Producers" action={<Link to="/discover" className="text-xs text-violet">More</Link>}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {people.slice(1, 9).map((p) => (
              <Panel key={p.id} className="flex flex-col items-center gap-2 p-3 text-center">
                <Avatar id={p.id} size={52} />
                <p className="truncate text-sm font-semibold">{p.name}</p>
                <RoleBadge role={p.role} />
              </Panel>
            ))}
          </div>
        </Section>
      </div>

      <Section title="Rising in The Crate" action={<Link to="/crate" className="text-xs text-violet">Open Crate</Link>}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {beats.slice(0, 4).map((b) => (
            <Panel key={b.id} className="flex items-center gap-3">
              <PlayButton track={{ id: b.id, title: b.title, artist: byId(b.producer).name, seed: b.seed }} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{b.title}</p>
                <p className="truncate text-xs text-muted-foreground">{byId(b.producer).name} · {b.bpm} BPM · {b.genre}</p>
              </div>
            </Panel>
          ))}
        </div>
      </Section>

      <Panel className="flex flex-wrap items-center justify-between gap-4 border-violet/40 bg-gradient-to-r from-violet/20 to-coral/10">
        <div className="flex items-center gap-3"><Users className="h-6 w-6 text-teal" /><p className="text-sm"><b>1,284</b> musicians online · <b>6</b> live rooms right now</p></div>
        <Link to="/compete" className="rounded-lg bg-coral px-4 py-2 text-sm font-semibold text-primary-foreground glow-coral">Join a Battle</Link>
      </Panel>
    </div>
  );
}
