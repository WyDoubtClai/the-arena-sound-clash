import { createFileRoute, Link } from "@tanstack/react-router";
import { Gift, Search, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UPLOAD_LIMITS } from "@/lib/artist-battle";
import { beats, byId, genres } from "@/lib/data";
import { Panel, PageHeader, Pills, PlayButton, Section, Waveform } from "@/components/arena/bits";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

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
        <div className="space-y-2">
          {list.map((b) => (
            <Panel key={b.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3 md:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1fr)_auto]">
              <PlayButton track={{ id: b.id, title: b.title, artist: byId(b.producer).name, seed: b.seed }} />
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate font-semibold">{b.title}{b.giveaway && <span className="flex items-center gap-1 rounded bg-gold/15 px-1.5 py-0.5 text-[10px] text-gold"><Gift className="h-3 w-3" />Giveaway</span>}</p>
                <p className="truncate text-xs text-muted-foreground"><Button variant="link" className="h-auto p-0 text-xs" onClick={() => setProducer(b.producer)}>{byId(b.producer).name}</Button> · {b.genre} · {b.bpm} BPM · {b.key} · {b.duration}</p>
              </div>
              <div className="hidden items-center gap-2 md:flex"><Waveform seed={b.seed} bars={40} className="h-7" /></div>
              <span className="rounded-full border border-teal/40 px-2 py-0.5 text-[10px] text-teal">60s · {b.segment}</span>
            </Panel>
          ))}
          {list.length === 0 && <p className="py-6 text-sm text-muted-foreground">No beats found.</p>}
        </div>
      </Section>
      <Dialog open={producer !== null} onOpenChange={(o) => { if (!o) setProducer(null); }}>
        <DialogContent className="bg-surface"><DialogHeader><DialogTitle>{producer ? byId(producer).name : "Producer"}</DialogTitle></DialogHeader>
          {producer && <><p className="text-sm text-muted-foreground">Producer · Level {byId(producer).level} · {byId(producer).followers} followers</p><div className="grid grid-cols-3 gap-3 text-center">{[[86, "Crate Draws"], [31, "Picks"], [19, "Battle Wins"]].map(([v, label]) => <div key={label}><p className="text-2xl font-bold text-violet">{v}</p><p className="text-xs text-muted-foreground">{label}</p></div>)}</div><p className="text-xs text-muted-foreground">Fictional exposure statistics.</p>{producer === "tonemadelt" && <Button asChild variant="outline"><Link to="/profile">View Profile</Link></Button>}</>}
        </DialogContent>
      </Dialog>
      <UploadModal open={open} onOpenChange={setOpen} />
    </div>
  );
}

function UploadModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [start, setStart] = useState([40]);
  const [file, setFile] = useState<string | null>(null);
  const allowance = [
    { l: "Rolling 24 hours", used: 1, max: UPLOAD_LIMITS[0] },
    { l: "Last 7 days", used: 6, max: UPLOAD_LIMITS[1] },
    { l: "Active beats", used: 22, max: UPLOAD_LIMITS[2] },
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-surface">
        <DialogHeader><DialogTitle className="font-display">Upload to The Crate</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">Frontend upload preview only. No files are stored or published.</p>
          <label className="block space-y-2 rounded-lg border border-dashed p-4"><span className="text-sm font-semibold">Full instrumental · WAV / MP3</span><input type="file" accept="audio/*" aria-label="Full instrumental" onChange={(e) => setFile(e.target.files?.[0]?.name ?? null)} className="block w-full text-xs" />{file && <span className="text-xs text-teal">{file} · local selection only</span>}</label>
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
          <Button onClick={() => { onOpenChange(false); toast.success("Upload preview complete — nothing stored or published"); }} className="w-full rounded-xl bg-violet py-2.5 font-semibold text-primary-foreground">Preview Submission</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
