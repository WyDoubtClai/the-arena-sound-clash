import { createFileRoute } from "@tanstack/react-router";
import { Heart, Play } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { genres, people, tracks } from "@/lib/data";
import { Avatar, Panel, PageHeader, Pills, PlayButton, RoleBadge, Section } from "@/components/arena/bits";

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Discover — The Arena" },
      { name: "description", content: "Trending tracks, rising producers and new artists across every genre." },
      { property: "og:title", content: "Discover — The Arena" },
      { property: "og:description", content: "Trending tracks, rising producers and new artists across every genre." },
    ],
  }),
  component: Discover,
});

const all = ["All", ...genres] as const;

function Discover() {
  const [g, setG] = useState<(typeof all)[number]>("All");
  const [follow, setFollow] = useState<string[]>([]);
  return (
    <div className="space-y-8">
      <PageHeader title="Discover" sub={`Showing ${g === "All" ? "everything" : g}`} />
      <Pills items={all} value={g} onChange={setG} />
      <Section title="Trending Artists">
        <div className="no-scrollbar flex gap-4 overflow-x-auto">
          {people.filter((p) => p.role === "Artist").map((p) => (
            <div key={p.id} className="w-36 shrink-0 space-y-2 text-center"><div className="mx-auto w-fit"><Avatar id={p.id} size={120} /></div><p className="font-semibold">{p.name}</p><p className="text-xs text-muted-foreground">{p.followers} followers</p></div>
          ))}
        </div>
      </Section>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Popular Tracks">
          <Panel className="space-y-2">
            {tracks.slice(0, 6).map((t, i) => (
              <div key={t.id} className="flex items-center gap-3 rounded-lg p-1">
                <span className="w-4 text-sm text-muted-foreground">{i + 1}</span>
                <PlayButton size="sm" track={t} />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{t.title}</p><p className="text-xs text-muted-foreground">{t.artist}</p></div>
                <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex"><Play className="h-3 w-3" />{t.plays}</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground"><Heart className="h-3 w-3" />{t.likes}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{t.dur}</span>
              </div>
            ))}
          </Panel>
        </Section>
        <Section title="Rising Producers">
          <Panel className="space-y-3">
            {people.filter((p) => p.role === "Producer" || p.role === "Engineer").map((p) => {
              const f = follow.includes(p.id);
              return (
                <div key={p.id} className="flex items-center gap-3">
                  <Avatar id={p.id} />
                  <div className="min-w-0 flex-1"><p className="truncate font-semibold">{p.name}</p><p className="text-xs text-muted-foreground">{p.followers} followers</p></div>
                  <RoleBadge role={p.role} />
                  <button onClick={() => setFollow(f ? follow.filter((x) => x !== p.id) : [...follow, p.id])} className={cn("rounded-md px-3 py-1 text-xs font-semibold", f ? "border text-muted-foreground" : "bg-violet text-primary-foreground")}>{f ? "Following" : "Follow"}</button>
                </div>
              );
            })}
          </Panel>
        </Section>
      </div>
    </div>
  );
}
