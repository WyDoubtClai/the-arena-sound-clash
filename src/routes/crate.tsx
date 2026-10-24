import { createFileRoute } from "@tanstack/react-router";
import { Gift, Sparkles, Upload, Vote } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { beats, byId, genres } from "@/lib/data";
import { Panel, PageHeader, Pills, PlayButton, Section, Waveform } from "@/components/arena/bits";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

export const Route = createFileRoute("/crate")({
  head: () => ({
    meta: [
      { title: "The Crate — Instrumental Library | The Arena" },
      { name: "description", content: "Browse battle-ready beats, upload instrumentals and try the Crate Draw." },
      { property: "og:title", content: "The Crate — Instrumental Library" },
      { property: "og:description", content: "Browse battle-ready beats, upload instrumentals and try the Crate Draw." },
    ],
  }),
  component: Crate,
});

const filters = ["All", ...genres] as const;
const draw = [
  { id: "d1", name: "Instrumental A", seed: 51, meta: "Trap · 140 BPM" },
  { id: "d2", name: "Instrumental B", seed: 52, meta: "R&B · 90 BPM" },
  { id: "d3", name: "Instrumental C", seed: 53, meta: "Drill · 144 BPM" },
  { id: "d4", name: "Instrumental D", seed: 54, meta: "Soul · 84 BPM" },
];

function Crate() {
  const [g, setG] = useState<(typeof filters)[number]>("All");
  const [open, setOpen] = useState(false);
  const list = beats.filter((b) => g === "All" || b.genre === g);
  return (
    <div className="space-y-8">
      <PageHeader title="The Crate" sub="Battle-ready instrumentals from the community.">
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-lg bg-violet px-4 py-2 text-sm font-semibold text-primary-foreground glow-violet"><Upload className="h-4 w-4" />Upload Beat</button>
      </PageHeader>
      <CrateDraw />
      <Section title="Browse Beats">
        <Pills items={filters} value={g} onChange={setG} />
        <div className="space-y-2">
          {list.map((b) => (
            <Panel key={b.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3 md:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1fr)_auto]">
              <PlayButton track={{ id: b.id, title: b.title, artist: byId(b.producer).name, seed: b.seed }} />
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate font-semibold">{b.title}{b.giveaway && <span className="flex items-center gap-1 rounded bg-gold/15 px-1.5 py-0.5 text-[10px] text-gold"><Gift className="h-3 w-3" />Giveaway</span>}</p>
                <p className="truncate text-xs text-muted-foreground">{byId(b.producer).name} · {b.genre} · {b.bpm} BPM · {b.key} · {b.duration}</p>
              </div>
              <div className="hidden items-center gap-2 md:flex"><Waveform seed={b.seed} bars={40} className="h-7" /></div>
              <span className="rounded-full border border-teal/40 px-2 py-0.5 text-[10px] text-teal">60s · {b.segment}</span>
            </Panel>
          ))}
        </div>
      </Section>
      <UploadModal open={open} onOpenChange={setOpen} />
    </div>
  );
}

function CrateDraw() {
  const [vote, setVote] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  return (
    <Panel className="space-y-4 border-violet/40 bg-gradient-to-br from-violet/10 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="text-xl font-bold">Crate Draw Demo</h2><p className="text-sm text-muted-foreground">Audition 4 blind snippets, vote, and reveal the battle beat.</p></div>
        <button disabled={!vote || spinning} onClick={() => { setSpinning(true); setRevealed(null); setTimeout(() => { setRevealed(Math.random() < 0.6 ? vote! : draw[Math.floor(Math.random() * 4)].id); setSpinning(false); }, 1600); }} className="flex items-center gap-2 rounded-lg bg-coral px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"><Sparkles className="h-4 w-4" />{spinning ? "Drawing…" : "Reveal Pick"}</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {draw.map((d, i) => {
          const win = revealed === d.id;
          return (
            <div key={d.id} className={cn("space-y-3 rounded-xl border bg-background p-4 transition", spinning && "animate-pulse", win && "border-gold glow-violet", revealed && !win && "opacity-40")}>
              <div className="flex items-center gap-3"><PlayButton size="sm" track={{ id: d.id, title: d.name, artist: "Crate Draw", seed: d.seed }} /><div><p className="text-sm font-semibold">{win ? beats[i].title : d.name}</p><p className="text-xs text-muted-foreground">{win ? `by ${byId(beats[i].producer).name}` : d.meta}</p></div></div>
              <Waveform seed={d.seed} bars={30} className="h-6" />
              <button onClick={() => setVote(d.id)} aria-pressed={vote === d.id} className={cn("flex w-full items-center justify-center gap-1 rounded-lg border py-1.5 text-xs", vote === d.id ? "border-violet bg-violet text-primary-foreground" : "")}><Vote className="h-3 w-3" />{vote === d.id ? "Your vote" : "Vote"}</button>
              {win && <p className="text-center text-xs font-bold text-gold">🏆 SELECTED</p>}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function UploadModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [start, setStart] = useState([40]);
  const allowance = [
    { l: "Last 24 hours", used: 1, max: 3 },
    { l: "Last 7 days", used: 6, max: 10 },
    { l: "Active beats", used: 22, max: 30 },
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-surface">
        <DialogHeader><DialogTitle className="font-display">Upload to The Crate</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {allowance.map((a) => (
              <div key={a.l} className="rounded-xl border bg-background p-3"><p className="text-xs text-muted-foreground">{a.l}</p><p className="font-display text-xl font-bold">{a.used}/{a.max}</p><div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-teal" style={{ width: `${(a.used / a.max) * 100}%` }} /></div></div>
            ))}
          </div>
          <div className="rounded-xl border bg-background p-3">
            <p className="mb-2 text-sm font-semibold">60s competition segment: {Math.floor(start[0] / 60)}:{String(start[0] % 60).padStart(2, "0")} – {Math.floor((start[0] + 60) / 60)}:{String((start[0] + 60) % 60).padStart(2, "0")}</p>
            <div className="relative">
              <Waveform seed={99} bars={90} className="h-14" />
              <div className="pointer-events-none absolute inset-y-0 rounded-md border-2 border-violet bg-violet/20" style={{ left: `${(start[0] / 180) * 100}%`, width: `${(60 / 180) * 100}%` }} />
            </div>
            <Slider className="mt-3" aria-label="Segment start" value={start} onValueChange={setStart} max={120} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {["Title", "Genre", "BPM", "Key"].map((f) => <input key={f} aria-label={f} placeholder={f} className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-violet" />)}
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[var(--gold)]" /> Mark as giveaway (free for battle winners)</label>
          <button onClick={() => { onOpenChange(false); toast.success("Beat submitted for review"); }} className="w-full rounded-xl bg-violet py-2.5 font-semibold text-primary-foreground">Submit Beat</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
