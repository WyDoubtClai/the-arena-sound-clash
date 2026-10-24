import { Pause, Play } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { byId, type Role } from "@/lib/data";
import { usePlayer, type Track } from "@/lib/player";
import { waveBars } from "@/lib/synth";

export function Avatar({ id, size = 40, ring }: { id: string; size?: number; ring?: boolean }) {
  const p = byId(id);
  return (
    <div
      aria-label={p.name}
      role="img"
      className={cn("grid shrink-0 place-items-center rounded-full font-display font-bold text-foreground", ring && "ring-2 ring-violet ring-offset-2 ring-offset-background")}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(135deg, hsl(${p.hue} 70% 45%), hsl(${(p.hue + 60) % 360} 70% 25%))`,
      }}
    >
      {p.name.slice(0, 1)}
    </div>
  );
}

const roleStyle: Record<Role, string> = {
  Artist: "bg-coral/15 text-coral border-coral/40",
  Producer: "bg-violet/15 text-violet border-violet/40",
  Engineer: "bg-teal/15 text-teal border-teal/40",
  Judge: "bg-gold/15 text-gold border-gold/40",
  Listener: "bg-muted text-muted-foreground border-border",
};
export function RoleBadge({ role }: { role: Role }) {
  return <span className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", roleStyle[role])}>{role}</span>;
}

export function Waveform({ seed, progress = 0, bars = 48, className, onSeek }: { seed: number; progress?: number; bars?: number; className?: string; onSeek?: (p: number) => void }) {
  const h = waveBars(seed, bars);
  return (
    <div
      className={cn("flex h-10 flex-1 cursor-pointer items-center gap-[2px]", className)}
      onClick={(e) => {
        if (!onSeek) return;
        const r = e.currentTarget.getBoundingClientRect();
        onSeek((e.clientX - r.left) / r.width);
      }}
      aria-hidden
    >
      {h.map((v, i) => (
        <span key={i} className={cn("flex-1 rounded-full transition-colors", i / bars < progress ? "bg-violet" : "bg-muted-foreground/30")} style={{ height: `${v * 100}%` }} />
      ))}
    </div>
  );
}

export function PlayButton({ track, size = "md" }: { track: Track; size?: "sm" | "md" }) {
  const pl = usePlayer();
  const on = pl.isCurrent(track.id);
  return (
    <button
      aria-label={on ? `Pause ${track.title}` : `Play ${track.title}`}
      onClick={(e) => { e.stopPropagation(); if (on) pl.pause(); else pl.play(track); }}
      className={cn("grid shrink-0 place-items-center rounded-full bg-violet text-primary-foreground transition hover:scale-105 glow-violet", size === "sm" ? "h-8 w-8" : "h-10 w-10")}
    >
      {on ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
    </button>
  );
}

export function AudioEmbed({ track }: { track: Track }) {
  const pl = usePlayer();
  const cur = pl.track?.id === track.id;
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-background/60 p-3">
      <PlayButton track={track} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{track.title}</p>
        <Waveform seed={track.seed} progress={cur ? pl.time / pl.duration : 0} className="h-7" onSeek={(p) => { if (!cur) pl.play(track); else pl.seek(p * pl.duration); }} />
      </div>
    </div>
  );
}

export function Section({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border bg-surface p-4", className)}>{children}</div>;
}

export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-3xl font-bold md:text-4xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

export function Pills<T extends string>({ items, value, onChange }: { items: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto" role="tablist">
      {items.map((i) => (
        <button
          key={i}
          role="tab"
          aria-selected={value === i}
          onClick={() => onChange(i)}
          className={cn("shrink-0 rounded-full border px-4 py-1.5 text-sm transition", value === i ? "border-violet bg-violet text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground")}
        >
          {i}
        </button>
      ))}
    </div>
  );
}
