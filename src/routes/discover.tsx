import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, Play, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { beats, genres, people, tracks, type Person, type Role } from "@/lib/data";
import { profileIds, type ProfileId } from "@/lib/profile-demo";
import { Avatar, Panel, PageHeader, Pills, PlayButton, RoleBadge, Section } from "@/components/arena/bits";

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Discover — The Arena" },
      { name: "description", content: "Find artists, producers and engineers, play popular tracks and explore Crate instrumentals by genre." },
      { property: "og:title", content: "Discover — The Arena" },
      { property: "og:description", content: "Find artists, producers and engineers, play popular tracks and explore Crate instrumentals by genre." },
    ],
  }),
  component: Discover,
});

const allGenres = ["All", ...genres] as const;
type Genre = (typeof allGenres)[number];
const roleTabs = ["All Creators", "Artists", "Producers", "Engineers", "Judges & Community"] as const;
type RoleTab = (typeof roleTabs)[number];
const roleMap: Record<RoleTab, Role[]> = {
  "All Creators": ["Artist", "Producer", "Engineer", "Judge", "Listener"],
  Artists: ["Artist"], Producers: ["Producer"], Engineers: ["Engineer"], "Judges & Community": ["Judge", "Listener"],
};
const competes = (r: Role) => r === "Artist" || r === "Producer" || r === "Engineer";
const isProfile = (id: string): id is ProfileId => (profileIds as string[]).includes(id);
const personByName = (name: string) => people.find((p) => p.name === name);
// Genres are only known for producers via their Crate beats.
const producerGenres = (id: string) => [...new Set(beats.filter((b) => b.producer === id).map((b) => b.genre))];

function CreatorName({ p, className }: { p: Person; className?: string }) {
  if (isProfile(p.id)) return <a href={`/profile?profile=${p.id}`} className={cn("hover:text-violet hover:underline", className)}>{p.name}</a>;
  return <span className={className} title="Individual profile is a preview — not available yet">{p.name}</span>;
}

function Discover() {
  const [g, setG] = useState<Genre>("All");
  const [role, setRole] = useState<RoleTab>("All Creators");
  const [q, setQ] = useState("");
  const [follow, setFollow] = useState<string[]>([]);
  const query = q.trim().toLowerCase();
  const filtered = g !== "All" || role !== "All Creators" || !!query;
  const reset = () => { setG("All"); setRole("All Creators"); setQ(""); };

  const creators = useMemo(() => people.filter((p) => {
    if (!roleMap[role].includes(p.role)) return false;
    if (g !== "All" && !producerGenres(p.id).includes(g)) return false;
    return !query || p.name.toLowerCase().includes(query) || p.role.toLowerCase().includes(query) || producerGenres(p.id).some((x) => x.toLowerCase().includes(query));
  }), [role, g, query]);
  // Tracks carry no genre data, so the genre filter hides them rather than guessing.
  const trackList = useMemo(() => g !== "All" ? [] : tracks.filter((t) => !query || t.title.toLowerCase().includes(query) || t.artist.toLowerCase().includes(query)), [g, query]);
  const beatList = useMemo(() => beats.filter((b) => (g === "All" || b.genre === g) && (!query || [b.title, b.genre, people.find((p) => p.id === b.producer)?.name ?? ""].some((x) => x.toLowerCase().includes(query)))), [g, query]);

  const toggle = (id: string) => setFollow((f) => f.includes(id) ? f.filter((x) => x !== id) : [...f, id]);
  const Empty = ({ text }: { text: string }) => (
    <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">{text} <button onClick={reset} className="ml-1 font-semibold text-violet hover:underline">Reset filters</button></div>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Discover" sub="Demo creators, tracks and Crate beats — prototype data, not live popularity." />
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Search Discover</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search creators, tracks, beats, genres…" className="w-full rounded-lg border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-violet" />
          </label>
          {filtered && <button onClick={reset} className="flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"><X className="h-3 w-3" />Reset</button>}
        </div>
        <Pills items={roleTabs} value={role} onChange={setRole} />
        <Pills items={allGenres} value={g} onChange={setG} />
        {g !== "All" && <p className="text-xs text-muted-foreground">Genre applies to Crate beats and their producers. Tracks and other creators have no genre data yet.</p>}
      </div>

      <Section title="Creators" action={<span className="rounded bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">Demo data</span>}>
        {creators.length === 0 ? <Empty text="No creators match." /> : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {creators.map((p) => {
              const f = follow.includes(p.id);
              const pg = producerGenres(p.id);
              const [w, l, d] = p.record;
              return (
                <Panel key={p.id} className="flex items-center gap-3 p-3">
                  <Avatar id={p.id} size={48} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2"><CreatorName p={p} className="truncate font-semibold" /><RoleBadge role={p.role} /></div>
                    <p className="truncate text-xs text-muted-foreground">
                      Lv {p.level}{p.followers ? ` · ${p.followers} followers` : ""}{pg.length ? ` · ${pg.join(", ")}` : ""}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {competes(p.role) && w + l + d > 0 ? <span className="text-gold">{w}-{l}-{d} W-L-D</span> : <span>Community member</span>}
                      {!isProfile(p.id) && <span className="ml-2 italic">Profile preview</span>}
                    </p>
                  </div>
                  <button onClick={() => toggle(p.id)} aria-pressed={f} aria-label={`${f ? "Unfollow" : "Follow"} ${p.name}`} className={cn("rounded-md px-3 py-1 text-xs font-semibold", f ? "border text-muted-foreground" : "bg-violet text-primary-foreground")}>{f ? "Following" : "Follow"}</button>
                </Panel>
              );
            })}
          </div>
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Popular Tracks" action={<span className="rounded bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">Demo plays</span>}>
          {trackList.length === 0 ? <Empty text={g !== "All" ? "Tracks have no genre data yet." : "No tracks match."} /> : (
            <Panel className="space-y-1">
              {trackList.map((t, i) => {
                const a = personByName(t.artist);
                return (
                  <div key={t.id} className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-secondary/50">
                    <span className="w-4 text-sm text-muted-foreground">{i + 1}</span>
                    <div aria-hidden className="h-10 w-10 shrink-0 rounded-md" style={{ background: `radial-gradient(circle at 30% 30%, hsl(${a?.hue ?? 270} 80% 65%), hsl(${(a?.hue ?? 270) + 60} 60% 20%))` }} />
                    <PlayButton size="sm" track={t} />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{t.title}</p><p className="truncate text-xs text-muted-foreground">{a ? <CreatorName p={a} /> : t.artist}</p></div>
                    <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex"><Play className="h-3 w-3" />{t.plays}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground"><Heart className="h-3 w-3" />{t.likes}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{t.dur}</span>
                  </div>
                );
              })}
            </Panel>
          )}
        </Section>
        <Section title="Crate Instrumentals" action={<Link to="/crate" className="text-xs font-semibold text-violet hover:underline">Open The Crate</Link>}>
          {beatList.length === 0 ? <Empty text="No beats match." /> : (
            <Panel className="space-y-1">
              {beatList.map((b) => {
                const p = people.find((x) => x.id === b.producer)!;
                return (
                  <div key={b.id} className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-secondary/50">
                    <div aria-hidden className="h-10 w-10 shrink-0 rounded-md" style={{ background: `radial-gradient(circle at 70% 30%, hsl(${p.hue} 80% 60%), hsl(${p.hue + 40} 60% 18%))` }} />
                    <PlayButton size="sm" track={{ id: b.id, title: b.title, artist: p.name, seed: b.seed, genre: b.genre }} />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{b.title}</p><p className="truncate text-xs text-muted-foreground"><CreatorName p={p} /> · {b.genre} · {b.bpm} BPM</p></div>
                    <span className="text-xs tabular-nums text-muted-foreground">{b.duration}</span>
                  </div>
                );
              })}
            </Panel>
          )}
        </Section>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link to="/rankings" className="rounded-xl border bg-card p-4 hover:border-violet"><p className="font-semibold">Rankings</p><p className="text-xs text-muted-foreground">See demo competitive standings.</p></Link>
        <Link to="/lobby" className="rounded-xl border bg-card p-4 hover:border-teal"><p className="font-semibold">The Lobby</p><p className="text-xs text-muted-foreground">Find collabs and discussions.</p></Link>
        <Link to="/crate" className="rounded-xl border bg-card p-4 hover:border-gold"><p className="font-semibold">The Crate</p><p className="text-xs text-muted-foreground">Browse every instrumental.</p></Link>
      </div>
    </div>
  );
}
