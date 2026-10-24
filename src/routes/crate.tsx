import { createFileRoute, Link } from "@tanstack/react-router";
import { Gift, Search, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UPLOAD_LIMITS } from "@/lib/artist-battle";
import { beats, byId, genres } from "@/lib/data";
import { Panel, PageHeader, Pills, PlayButton, Section, Waveform } from "@/components/arena/bits";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExcerptSelector } from "@/components/arena/excerpt-selector";

export const Route = createFileRoute("/crate")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "The Crate — Instrumental Library | The Arena" },
      { name: "description", content: "Browse producer instrumentals, preview beats and explore the frontend upload demonstration." },
      { property: "og:title", content: "The Crate — Instrumental Library" },
      { property: "og:description", content: "Browse producer instrumentals, preview beats and explore the frontend upload demonstration." },
    ],
  }),
  component: Crate,
});

const filters = ["All", ...genres] as const;

type Listing = "Competition Only" | "Winner Giveaway" | "For Sale" | "Buy It or Win It";
const LISTING: Record<Listing, { cls: string; price?: string }> = {
  "Competition Only": { cls: "border-violet/50 bg-violet/15 text-violet" },
  "Winner Giveaway": { cls: "border-gold/50 bg-gold/15 text-gold" },
  "For Sale": { cls: "border-teal/50 bg-teal/15 text-teal", price: "$29.99" },
  "Buy It or Win It": { cls: "border-coral/50 bg-coral/15 text-coral", price: "$39.99" },
};
// Mock marketplace labels derived from shared beat data (no real sales).
function listingFor(b: (typeof beats)[number]): Listing {
  if (b.giveaway) return b.seed % 2 === 0 ? "Buy It or Win It" : "Winner Giveaway";
  return b.seed % 2 === 0 ? "For Sale" : "Competition Only";
}
function producerStats(id: string) {
  const own = beats.filter((b) => b.producer === id);
  const n = own.reduce((s, b) => s + b.seed, 0);
  return { selections: n * 2 + 14, battleUses: n + 9, artistWins: Math.round(n / 3) + 2, giveaways: own.filter((b) => b.giveaway).length * 4, sales: own.filter((b) => !b.giveaway).length * 7 + 3, producerWins: byId(id).record[0] };
}
function Crate() {
  const [g, setG] = useState<(typeof filters)[number]>("All");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [producer, setProducer] = useState<string | null>(null);
  const list = beats.filter((b) => (g === "All" || b.genre === g) && `${b.title} ${byId(b.producer).name}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="space-y-8">
      <PageHeader title="The Crate" sub="Battle-ready instrumentals from the community.">
        <Button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-lg bg-violet px-4 py-2 text-sm font-semibold text-primary-foreground glow-violet"><Upload className="h-4 w-4" />Upload Beat</Button>
      </PageHeader>

      <Section title="Browse Beats">
        <label className="flex items-center gap-2 rounded-lg border bg-surface px-3 py-2"><Search className="h-4 w-4 text-muted-foreground" /><input aria-label="Search beats or producers" placeholder="Search beats or producers…" value={query} onChange={(e) => setQuery(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
        <Pills items={filters} value={g} onChange={setG} />
        <div className="flex flex-wrap gap-2 text-[10px]" aria-label="Listing type legend">
          {Object.entries(LISTING).map(([k, v]) => <span key={k} className={`rounded-full border px-2 py-0.5 ${v.cls}`}>{k}</span>)}
          <span className="rounded-full border border-dashed px-2 py-0.5 text-muted-foreground">Marketplace labels are prototype previews</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((b) => {
            const p = byId(b.producer);
            const type = listingFor(b);
            const st = producerStats(b.producer);
            return (
              <Panel key={b.id} className="group overflow-hidden p-0">
                <div className="relative aspect-[16/9] overflow-hidden" style={{ background: `radial-gradient(circle at ${20 + (b.seed * 13) % 60}% 30%, hsl(${p.hue} 90% 60% / .55), transparent 60%), linear-gradient(135deg, hsl(${(p.hue + 40) % 360} 70% 22%), var(--background))` }}>
                  <Waveform seed={b.seed} bars={48} className="absolute inset-x-4 bottom-4 h-10 opacity-70" />
                  <span className={`absolute left-3 top-3 rounded-full border px-2 py-0.5 text-[10px] font-semibold backdrop-blur ${LISTING[type].cls}`}>{type}</span>
                  <span className="absolute right-3 top-3 rounded-full border border-teal/40 bg-background/60 px-2 py-0.5 text-[10px] text-teal backdrop-blur">60s · {b.segment}</span>
                  <div className="absolute bottom-3 right-3"><PlayButton track={{ id: b.id, title: b.title, artist: p.name, seed: b.seed }} /></div>
                </div>
                <div className="space-y-3 p-4">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate font-display text-lg font-semibold">{b.title}{b.giveaway && <Gift aria-label="Giveaway" className="h-4 w-4 shrink-0 text-gold" />}</p>
                    <Button variant="link" className="h-auto p-0 text-xs text-muted-foreground" onClick={() => setProducer(b.producer)}>by {p.name} · Lv {p.level}</Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    {[b.genre, `${b.bpm} BPM`, b.key, b.duration, `${b.plays} plays`].map((t) => <span key={t} className="rounded-md bg-muted px-2 py-0.5 text-muted-foreground">{t}</span>)}
                  </div>
                  <div className="grid grid-cols-3 gap-2 border-t pt-3 text-center">
                    {[[st.selections, "Selections"], [st.battleUses, "Battle uses"], [st.artistWins, "Artist wins"]].map(([v, l]) => <div key={l}><p className="font-display text-sm font-bold text-violet">{v}</p><p className="text-[10px] text-muted-foreground">{l}</p></div>)}
                  </div>
                  {(type === "For Sale" || type === "Buy It or Win It") && <Button variant="outline" size="sm" className="w-full" onClick={() => toast.info("Purchasing is a future feature — prototype only")}>{LISTING[type].price} · Preview purchase</Button>}
                </div>
              </Panel>
            );
          })}
        </div>
        {list.length === 0 && <p className="py-6 text-sm text-muted-foreground">No beats found.</p>}
      </Section>
      <Dialog open={producer !== null} onOpenChange={(o) => { if (!o) setProducer(null); }}>
        <DialogContent className="bg-surface"><DialogHeader><DialogTitle>{producer ? byId(producer).name : "Producer"}</DialogTitle></DialogHeader>
          {producer && (() => { const s = producerStats(producer); return <><p className="text-sm text-muted-foreground">Producer · Level {byId(producer).level} · {byId(producer).followers} followers</p><div className="grid grid-cols-3 gap-3 text-center">{[[s.selections, "Beat Selections"], [s.battleUses, "Battle Usage"], [s.artistWins, "Artist Wins"], [s.giveaways, "Giveaways"], [s.sales, "Sales (mock)"], [s.producerWins, "Producer Wins"]].map(([v, label]) => <div key={label}><p className="text-2xl font-bold text-violet">{v}</p><p className="text-xs text-muted-foreground">{label}</p></div>)}</div><p className="text-xs text-muted-foreground">Fictional statistics. Sales are a prototype preview.</p>{producer === "tonemadelt" && <Button asChild variant="outline"><Link to="/profile">View Profile</Link></Button>}</>; })()}
        </DialogContent>
      </Dialog>
      <UploadModal open={open} onOpenChange={setOpen} />
    </div>
  );
}

function UploadModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [valid, setValid] = useState(false);
  const allowance = [
    { l: "Rolling 24 hours", used: 1, max: UPLOAD_LIMITS[0] },
    { l: "Last 7 days", used: 6, max: UPLOAD_LIMITS[1] },
    { l: "Active beats", used: 22, max: UPLOAD_LIMITS[2] },
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] max-w-2xl overflow-y-auto bg-surface">
        <DialogHeader><DialogTitle className="font-display">Upload to The Crate</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <DialogDescription className="text-xs text-muted-foreground">Frontend upload preview only. No files are stored or published.</DialogDescription>
          {open && <ExcerptSelector onValidityChange={setValid} />}
          <div className="grid gap-3 sm:grid-cols-3">
            {allowance.map((a) => (
              <div key={a.l} className="rounded-xl border bg-background p-3"><p className="text-xs text-muted-foreground">{a.l}</p><p className="font-display text-xl font-bold">{a.used}/{a.max}</p><div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-teal" style={{ width: `${(a.used / a.max) * 100}%` }} /></div></div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {["Title", "Genre", "BPM", "Key"].map((f) => <input key={f} aria-label={f} placeholder={f} className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-violet" />)}
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[var(--gold)]" /> Mark as giveaway (free for battle winners)</label>
          <Button disabled={!valid} onClick={() => { onOpenChange(false); toast.success("Upload preview complete — nothing stored or published"); }} className="w-full rounded-xl bg-violet py-2.5 font-semibold text-primary-foreground">Preview Submission</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
