import { createFileRoute, Link } from "@tanstack/react-router";
import { Disc3, Headphones, ListMusic, Swords, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Panel, PageHeader, Section } from "@/components/arena/bits";

export const Route = createFileRoute("/compete")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Compete — The Arena" },
      { name: "description", content: "Producer and Artist Quick Battles, custom battle rooms and Song-for-Song battles." },
      { property: "og:title", content: "Compete — The Arena" },
      { property: "og:description", content: "Producer and Artist Quick Battles, custom battle rooms and Song-for-Song battles." },
    ],
  }),
  component: Compete,
});

const modes = [
  { icon: Zap, color: "violet", title: "Producer Quick Battle", rules: ["8 producers", "15 min create + 3 min upload", "45-second beat entry", "Shared sample kit"], cta: "Enter the Gauntlet", to: "/gauntlet" as const },
  { icon: Disc3, color: "coral", title: "Artist Quick Battle", rules: ["Beat drawn from The Crate", "15 min to write & record", "60-second entry", "Live crowd judging"], cta: "Enter Artist Quick Battle", to: "/artist-quick-battle" as const },
  { icon: Users, color: "teal", title: "Custom Battle Rooms", rules: ["Up to 20 people", "Pick performers & judges", "Your own rules & timers", "Private or public"], cta: "Create Room" },
  { icon: ListMusic, color: "gold", title: "Song-for-Song", rules: ["1–8 songs per side", "Head-to-head rounds", "Judge panel scoring", "Full tracks allowed"], cta: "Challenge Someone" },
];

const live = [
  { t: "Beat Battle — Dark Vibes", m: "Producers · 15 min", n: "6/8", ids: ["tonemadelt", "kairo", "dretracks"] },
  { t: "Lyric Battle — No Limits", m: "Rappers · 15 min", n: "6/8", ids: ["lyrick", "blaze", "lexivibes"] },
  { t: "Song Battle — Open Genre", m: "Artists · Full songs", n: "3/4", ids: ["novarae", "miasoul"] },
];

function Compete() {
  return (
    <div className="space-y-8">
      <PageHeader title="Compete" sub="Jump into a battle, create a room, or join as a judge.">
        <Link to="/gauntlet" className="flex items-center gap-2 rounded-lg bg-coral px-4 py-2 text-sm font-semibold text-primary-foreground glow-coral"><Swords className="h-4 w-4" /> Launch Live Gauntlet</Link>
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {modes.map((m) => (
          <Panel key={m.title} className="flex flex-col gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-xl" style={{ background: `color-mix(in oklab, var(--${m.color}) 18%, transparent)`, color: `var(--${m.color})` }}><m.icon className="h-6 w-6" /></div>
            <h3 className="text-lg font-bold">{m.title}</h3>
            <ul className="flex-1 space-y-1.5 text-sm text-muted-foreground">{m.rules.map((r) => <li key={r}>• {r}</li>)}</ul>
            {m.to ? (
              <Link to={m.to} className="rounded-lg py-2 text-center text-sm font-semibold text-primary-foreground" style={{ background: `var(--${m.color})` }}>{m.cta}</Link>
            ) : (
              <button onClick={() => toast.success(`${m.title}: coming in Phase 2`)} className="rounded-lg py-2 text-sm font-semibold text-primary-foreground" style={{ background: `var(--${m.color})` }}>{m.cta}</button>
            )}
          </Panel>
        ))}
      </div>
      <Section title="Live Rooms">
        <div className="space-y-3">
          {live.map((r) => (
            <Panel key={r.t} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex">
              <div className="min-w-0 sm:flex-1"><p className="truncate font-semibold">{r.t}</p><p className="text-xs text-muted-foreground">{r.m}</p></div>
              <div className="hidden -space-x-2 sm:flex">{r.ids.map((i) => <Avatar key={i} id={i} size={28} />)}</div>
              <span className="hidden text-sm text-muted-foreground sm:block">{r.n}</span>
              <div className="flex items-center gap-2">
                <span className="rounded bg-coral px-2 py-0.5 text-[10px] font-bold text-primary-foreground">LIVE</span>
                <Link to="/gauntlet" className="flex items-center gap-1 rounded-lg border border-violet px-3 py-1.5 text-xs text-violet"><Headphones className="h-3 w-3" />Join as Judge</Link>
              </div>
            </Panel>
          ))}
        </div>
      </Section>
    </div>
  );
}
