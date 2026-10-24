import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, Calendar, Compass, Crown, Disc3, Home, MessagesSquare, Pause, Play, Plus, Search, Swords, Trophy, User, Volume2, Zap } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { me } from "@/lib/data";
import { fmt, usePlayer } from "@/lib/player";
import { Avatar, Waveform } from "./bits";
import { Slider } from "@/components/ui/slider";

const nav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/lobby", label: "The Lobby", icon: MessagesSquare },
  { to: "/compete", label: "Compete", icon: Swords },
  { to: "/gauntlet", label: "The Gauntlet", icon: Zap },
  { to: "/crate", label: "The Crate", icon: Disc3 },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/events", label: "Events", icon: Calendar },
  { to: "/rankings", label: "Rankings", icon: Trophy },
  { to: "/profile", label: "Profile", icon: User },
] as const;

const mobileNav = [nav[0], nav[1], nav[2], nav[5], nav[8]];

function Logo() {
  return (
    <Link to="/" className="block leading-none" aria-label="The Arena home">
      <span className="block font-display text-[10px] font-bold tracking-[0.3em] text-muted-foreground">THE</span>
      <span className="block font-display text-2xl font-bold italic tracking-tight text-glow">ARENA</span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const active = (to: string) => (to === "/" ? path === "/" : path.startsWith(to));
  return (
    <div className="min-h-screen w-full">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-sidebar p-5 lg:flex">
        <Logo />
        <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label="Main">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition", active(n.to) ? "bg-violet/15 font-semibold text-violet" : "text-muted-foreground hover:bg-surface hover:text-foreground")}>
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
          <CreateButton className="mt-4" />
        </nav>
        <Link to="/profile" className="flex items-center gap-3 rounded-xl border bg-surface p-3">
          <Avatar id={me.id} size={36} />
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{me.name}</p><p className="text-xs text-muted-foreground">Level {me.level}</p></div>
        </Link>
      </aside>

      <div className="lg:pl-60">
        <TopBar />
        <main className="mx-auto max-w-7xl px-4 pb-44 pt-4 md:px-6 lg:pb-28">{children}</main>
      </div>

      <PlayerBar />

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-sidebar/95 backdrop-blur lg:hidden" aria-label="Mobile">
        {mobileNav.map((n) => (
          <Link key={n.to} to={n.to} className={cn("flex flex-col items-center gap-1 py-2 text-[11px]", active(n.to) ? "text-violet" : "text-muted-foreground")}>
            <n.icon className="h-5 w-5" /> {n.label.replace("The ", "")}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function CreateButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("relative", className)}>
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet px-4 py-2 text-sm font-semibold text-primary-foreground glow-violet hover:brightness-110">
        <Plus className="h-4 w-4" /> Create
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border bg-popover p-1 shadow-xl">
          {[
            { l: "New Lobby post", to: "/lobby" },
            { l: "Upload beat to Crate", to: "/crate" },
            { l: "Create battle room", to: "/compete" },
            { l: "Start Quick Battle", to: "/gauntlet" },
          ].map((o) => (
            <Link key={o.l} to={o.to} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm hover:bg-accent">{o.l}</Link>
          ))}
        </div>
      )}
    </div>
  );
}

const notifs = [
  { t: "Nova Rae liked your track 'City Dreams'", c: "text-coral" },
  { t: "Producer Showdown starts in 38h — you're registered", c: "text-gold" },
  { t: "ToneMadelt replied to your Lobby post", c: "text-teal" },
  { t: "You earned +120 XP from last battle", c: "text-violet" },
];

function TopBar() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  return (
    <header className="sticky top-0 z-20 grid grid-cols-[auto_minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b bg-background/85 px-4 py-3 backdrop-blur md:px-6">
      <div className="lg:hidden"><Logo /></div>
      <form className="relative lg:max-w-md" onSubmit={(e) => { e.preventDefault(); if (q) toast(`Searching for “${q}”…`); }} role="search">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" placeholder="Search artists, beats, people…" className="w-full rounded-full border bg-surface py-2 pl-9 pr-3 text-sm outline-none focus:border-violet" />
      </form>
      <div className="flex items-center gap-2">
        <div className="relative">
          <button aria-label="Notifications" onClick={() => setOpen(!open)} className="relative grid h-9 w-9 place-items-center rounded-full border bg-surface hover:border-violet">
            <Bell className="h-4 w-4" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-coral" />
          </button>
          {open && (
            <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border bg-popover p-2 shadow-xl">
              <p className="px-2 pb-2 text-xs font-semibold text-muted-foreground">Notifications</p>
              {notifs.map((n) => (
                <div key={n.t} className="flex gap-2 rounded-lg px-2 py-2 text-sm hover:bg-accent"><Crown className={cn("mt-0.5 h-4 w-4 shrink-0", n.c)} />{n.t}</div>
              ))}
            </div>
          )}
        </div>
        <div className="hidden sm:block"><CreateButton /></div>
        <Link to="/profile" aria-label="Your profile" className="relative">
          <Avatar id={me.id} size={36} ring />
          <span className="absolute -bottom-1 -right-1 rounded-full bg-gold px-1 text-[9px] font-bold text-primary-foreground">{me.level}</span>
        </Link>
      </div>
    </header>
  );
}

function PlayerBar() {
  const pl = usePlayer();
  const t = pl.track;
  return (
    <div className="fixed inset-x-0 bottom-[57px] z-30 border-t bg-surface/95 backdrop-blur lg:bottom-0 lg:left-60">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 md:px-6">
        <div className="flex min-w-0 items-center gap-3 md:w-56">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-violet to-coral"><Disc3 className={cn("h-5 w-5 text-primary-foreground", pl.playing && "animate-spin")} /></div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{t?.title ?? "Nothing playing"}</p>
            <p className="truncate text-xs text-muted-foreground">{t?.artist ?? "Pick a track anywhere"}</p>
          </div>
        </div>
        <button aria-label={pl.playing ? "Pause" : "Play"} disabled={!t} onClick={pl.toggle} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-foreground text-background disabled:opacity-40">
          {pl.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
        </button>
        <div className="hidden min-w-0 flex-1 items-center gap-2 sm:flex">
          <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{fmt(pl.time)}</span>
          <Waveform seed={t?.seed ?? 1} bars={80} progress={t ? pl.time / pl.duration : 0} className="h-8" onSeek={(p) => t && pl.seek(p * pl.duration)} />
          <span className="w-9 text-xs tabular-nums text-muted-foreground">{fmt(pl.duration)}</span>
        </div>
        <div className="ml-auto hidden w-32 items-center gap-2 md:flex">
          <Volume2 className="h-4 w-4 text-muted-foreground" />
          <Slider aria-label="Volume" value={[pl.volume * 100]} onValueChange={([v]) => pl.setVolume(v / 100)} max={100} />
        </div>
      </div>
    </div>
  );
}
