import { createFileRoute } from "@tanstack/react-router";
import { Crown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { me, people } from "@/lib/data";
import { Avatar, Panel, PageHeader, Pills } from "@/components/arena/bits";

export const Route = createFileRoute("/rankings")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Rankings — Leaderboards | The Arena" },
      { name: "description", content: "Leaderboards for artists, producers and judges by XP and community reputation." },
      { property: "og:title", content: "Rankings — Leaderboards" },
      { property: "og:description", content: "Leaderboards for artists, producers and judges by XP and community reputation." },
    ],
  }),
  component: Rankings,
});

const tabs = ["All Members", "Artists", "Producers", "Judges"] as const;
const metrics = ["XP", "Reputation"] as const;

function Rankings() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("All Members");
  const [m, setM] = useState<(typeof metrics)[number]>("XP");
  const role = { "All Members": null, Artists: "Artist", Producers: "Producer", Judges: "Judge" }[tab];
  const list = people.filter((p) => !role || p.role === role).sort((a, b) => (m === "XP" ? b.xp - a.xp : b.rep - a.rep));
  const val = (p: (typeof people)[number]) => (m === "XP" ? `${p.xp.toLocaleString()} XP` : `${p.rep} rep`);
  const podium = [list[1], list[0], list[2]].filter(Boolean);
  const myRank = list.findIndex((p) => p.id === me.id);
  return (
    <div className="space-y-6">
      <PageHeader title="Rankings" sub="XP rewards competing. Reputation rewards helping the community." />
      <div className="flex flex-wrap gap-3"><Pills items={tabs} value={tab} onChange={setTab} /><Pills items={metrics} value={m} onChange={setM} /></div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <div className="grid grid-cols-3 items-end gap-3">
            {podium.map((p) => {
              const place = list.indexOf(p) + 1;
              return (
                <Panel key={p.id} className={cn("flex flex-col items-center gap-2 text-center", place === 1 && "border-gold/60 bg-gold/10 pb-8")}>
                  {place === 1 && <Crown className="h-6 w-6 text-gold" />}
                  <Avatar id={p.id} size={place === 1 ? 72 : 56} />
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{val(p)}</p>
                  <span className="font-display text-2xl font-bold text-violet">#{place}</span>
                </Panel>
              );
            })}
          </div>
          <Panel className="divide-y p-0">
            {list.slice(3).map((p, i) => (
              <div key={p.id} className={cn("flex items-center gap-3 px-4 py-3", p.id === me.id && "bg-violet/10")}>
                <span className="w-6 font-display font-bold text-muted-foreground">{i + 4}</span>
                <Avatar id={p.id} size={32} />
                <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                <span className="text-sm">{val(p)}</span>
                <span className="hidden w-20 text-right text-xs text-muted-foreground sm:block">{p.record.join(" - ")}</span>
              </div>
            ))}
          </Panel>
        </div>
        <aside className="space-y-4">
          <Panel>
            <p className="text-sm text-muted-foreground">Your Rank</p>
            <p className="font-display text-4xl font-bold text-gold">{myRank >= 0 ? `#${myRank + 1}` : "—"}</p>
            <p className="text-sm">{me.xp.toLocaleString()} XP · {me.rep} rep</p>
          </Panel>
          <Panel className="space-y-3 text-sm">
            <p className="font-semibold">XP vs Reputation</p>
            <p className="text-muted-foreground"><b className="text-violet">XP</b> comes from battle placements, wins and completed challenges.</p>
            <p className="text-muted-foreground"><b className="text-teal">Reputation</b> comes from helpful feedback, fair judging and community votes.</p>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
