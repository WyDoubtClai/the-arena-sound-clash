import { createFileRoute } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { events } from "@/lib/data";
import { Avatar, Panel, PageHeader, Pills } from "@/components/arena/bits";
import hero from "@/assets/hero-battle.jpg";

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { title: "Events — Scheduled Battles | The Arena" },
      { name: "description", content: "Upcoming song battles, beat battles, cyphers and tournaments with live countdowns." },
      { property: "og:title", content: "Events — Scheduled Battles" },
      { property: "og:description", content: "Upcoming song battles, beat battles, cyphers and tournaments with live countdowns." },
    ],
  }),
  component: Events,
});

const types = ["All", "Song Battles", "Beat Battles", "Lyric Battles", "Tournaments"] as const;

function useNow() {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => { setN(Date.now()); const id = setInterval(() => setN(Date.now()), 1000); return () => clearInterval(id); }, []);
  return n;
}
const base = Date.now();
function countdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
}

function Events() {
  const [t, setT] = useState<(typeof types)[number]>("All");
  const [reg, setReg] = useState<string[]>(["e2"]);
  const now = useNow();
  const list = events.filter((e) => t === "All" || e.type === t);
  return (
    <div className="space-y-6">
      <PageHeader title="Events" sub="Scheduled battles, showcases and tournaments." />
      <section className="relative overflow-hidden rounded-3xl border">
        <img src={hero} alt="" width={1600} height={800} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
        <div className="relative p-6 md:p-10">
          <h2 className="text-3xl font-bold italic md:text-5xl">CLAI vs. KING CARTER</h2>
          <p className="mt-2 text-muted-foreground">Song-for-Song Battle · 3 Rounds · 18 Judges</p>
          <p className="mt-3 font-display text-xl tabular-nums text-gold">{now ? countdown(base + 20 * 3600e3 - now) : "—"}</p>
        </div>
      </section>
      <Pills items={types} value={t} onChange={setT} />
      <div className="space-y-3">
        {list.map((e) => {
          const r = reg.includes(e.id);
          return (
            <Panel key={e.id} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
              <div className="min-w-0">
                <p className="font-display text-lg font-semibold">{e.title}</p>
                <p className="text-sm text-muted-foreground">{e.meta}</p>
                <div className="mt-2 flex -space-x-2">{e.roster.map((id) => <Avatar key={id} id={id} size={26} />)}<span className="ml-4 self-center pl-2 text-xs text-muted-foreground">{e.roster.length + (r ? 1 : 0)} registered</span></div>
              </div>
              <p className="flex items-center gap-2 text-sm tabular-nums text-gold"><Clock className="h-4 w-4" />{now ? countdown(base + e.inHours * 3600e3 - now) : "—"}</p>
              <button onClick={() => { setReg(r ? reg.filter((x) => x !== e.id) : [...reg, e.id]); if (!r) toast.success(`Registered for ${e.title}`); }} className={cn("rounded-lg px-5 py-2 text-sm font-semibold", r ? "border border-teal text-teal" : "bg-violet text-primary-foreground")}>{r ? "Registered ✓" : "Register"}</button>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
