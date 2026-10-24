import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, Heart, MapPin, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { byId, tracks } from "@/lib/data";
import { usePlayer } from "@/lib/player";
import { Avatar, Panel, Pills, PlayButton, RoleBadge, Waveform } from "@/components/arena/bits";
import banner from "@/assets/studio-banner.jpg";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Profile — The Arena" },
      { name: "description", content: "Artist and producer profiles with discography, battle record and exposure stats." },
      { property: "og:title", content: "Profile — The Arena" },
      { property: "og:description", content: "Artist and producer profiles with discography, battle record and exposure stats." },
    ],
  }),
  component: Profile,
});

const who = ["blaze", "tonemadelt"] as const;
const tabs = ["Music", "Battles", "Achievements"] as const;

function Profile() {
  const [id, setId] = useState<(typeof who)[number]>("blaze");
  const [tab, setTab] = useState<(typeof tabs)[number]>("Music");
  const p = byId(id);
  const pl = usePlayer();
  const [w, l, d] = p.record;
  const mine = id === "blaze" ? tracks.slice(4) : tracks.slice(0, 3).map((t, i) => ({ ...t, id: `tm${i}`, artist: "ToneMadelt", title: ["Midnight Drive", "City Lights", "Sunday Vibes"][i] }));
  return (
    <div className="space-y-6">
      <div className="flex gap-2" role="tablist" aria-label="Demo profile">
        {who.map((x) => <button key={x} role="tab" aria-selected={id === x} onClick={() => setId(x)} className={cn("rounded-full border px-3 py-1 text-xs", id === x ? "border-violet text-violet" : "text-muted-foreground")}>View {byId(x).name}</button>)}
      </div>
      <section className="overflow-hidden rounded-3xl border bg-surface">
        <img src={banner} alt="" width={1600} height={608} className="h-36 w-full object-cover md:h-52" />
        <div className="flex flex-wrap items-end gap-4 px-5 pb-5">
          <div className="-mt-12"><Avatar id={p.id} size={112} ring /></div>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-3xl font-bold">{p.name}<BadgeCheck className="h-6 w-6 text-violet" /></h1>
            <div className="mt-1 flex flex-wrap items-center gap-2"><RoleBadge role={p.role} />{id === "blaze" ? <RoleBadge role="Producer" /> : <RoleBadge role="Engineer" />}<span className="rounded-md border border-gold/40 px-1.5 py-0.5 text-[10px] font-semibold text-gold">LEVEL {p.level}</span></div>
            <p className="mt-2 text-sm text-muted-foreground">Making music. Competing. Building. Open to collabs.</p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{p.city}</p>
          </div>
          <div className="flex gap-6 text-center">
            {[[p.followers, "Followers"], ["1.1K", "Following"], ["48.7K", "Plays"]].map(([v, k]) => <div key={k}><p className="font-display text-xl font-bold">{v}</p><p className="text-xs text-muted-foreground">{k}</p></div>)}
          </div>
          <div className="flex gap-2">
            <button onClick={() => toast("Edit profile coming soon")} className="rounded-lg border px-3 py-1.5 text-sm">Edit Profile</button>
            <button onClick={() => toast("Profile link copied")} aria-label="Share" className="rounded-lg border px-3 py-1.5"><Share2 className="h-4 w-4" /></button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Pills items={tabs} value={tab} onChange={setTab} />
          {tab === "Music" && (
            <Panel className="space-y-3">
              {mine.map((t) => (
                <div key={t.id} className="flex items-center gap-3">
                  <PlayButton track={t} />
                  <div className="w-32 min-w-0"><p className="truncate text-sm font-semibold">{t.title}</p><p className="text-xs text-muted-foreground">{t.plays} plays</p></div>
                  <Waveform seed={t.seed} bars={50} progress={pl.track?.id === t.id ? pl.time / pl.duration : 0} className="hidden h-8 sm:flex" />
                  <span className="text-xs text-muted-foreground">{t.dur}</span>
                  <span className="flex items-center gap-1 text-xs text-coral"><Heart className="h-3 w-3" />{t.likes}</span>
                </div>
              ))}
            </Panel>
          )}
          {tab === "Battles" && (
            <Panel className="space-y-2 text-sm">
              {["W vs Lyric K · Song-for-Song · 4.4★", "W vs Kairo · Quick Battle · 1st/8", "L vs Nova Rae · Song-for-Song · 3.9★", "D vs Mia Soul · Custom Room", "W vs Lexi Vibes · Artist Quick Battle"].map((b) => (
                <p key={b} className="flex items-center gap-3 rounded-lg border bg-background p-3"><span className={cn("font-display font-bold", b[0] === "W" ? "text-teal" : b[0] === "L" ? "text-coral" : "text-gold")}>{b[0]}</span>{b.slice(2)}</p>
              ))}
            </Panel>
          )}
          {tab === "Achievements" && (
            <Panel className="grid grid-cols-3 gap-3 text-center text-sm sm:grid-cols-6">
              {["🔥 Hot Streak", "👑 Champion", "🎤 First Battle", "⭐ Fair Judge", "🎛️ Crate Pick", "💯 Perfect 5"].map((a) => <div key={a} className="rounded-xl border bg-background p-3">{a}</div>)}
            </Panel>
          )}
        </div>
        <aside className="space-y-4">
          <Panel>
            <div className="flex justify-between text-sm"><span className="font-semibold">Level {p.level}</span><span className="text-muted-foreground">{p.xp.toLocaleString()} / {(p.level * 1000).toLocaleString()} XP</span></div>
            <div className="mt-2 h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-violet to-coral" style={{ width: `${Math.min(100, (p.xp / (p.level * 1000)) * 100)}%` }} /></div>
          </Panel>
          <Panel><p className="text-sm text-muted-foreground">Reputation</p><p className="font-display text-3xl font-bold text-teal">{p.rep}</p><p className="text-xs text-muted-foreground">Top 10% of members</p></Panel>
          <Panel>
            <p className="mb-3 font-semibold">Battle Record</p>
            <div className="grid grid-cols-3 text-center">
              <div><p className="font-display text-2xl font-bold text-teal">{w}</p><p className="text-xs text-muted-foreground">Wins</p></div>
              <div><p className="font-display text-2xl font-bold text-coral">{l}</p><p className="text-xs text-muted-foreground">Losses</p></div>
              <div><p className="font-display text-2xl font-bold text-gold">{d}</p><p className="text-xs text-muted-foreground">Draws</p></div>
            </div>
          </Panel>
          <Panel>
            <p className="mb-3 font-semibold">Producer Exposure</p>
            <div className="grid grid-cols-3 text-center">
              {[[id === "blaze" ? 14 : 86, "Crate Draws"], [id === "blaze" ? 5 : 31, "Picks"], [id === "blaze" ? 3 : 19, "Battle Wins"]].map(([v, k]) => <div key={k}><p className="font-display text-2xl font-bold text-violet">{v}</p><p className="text-xs text-muted-foreground">{k}</p></div>)}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
