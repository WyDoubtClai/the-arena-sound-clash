import { Star } from "lucide-react";
import { Avatar } from "./bits";
import { Button } from "@/components/ui/button";
import { byId, me } from "@/lib/data";
import { fmt } from "@/lib/player";
import { cn } from "@/lib/utils";

export function BattleParticipants({ roster, ready }: { roster: string[]; ready: string[] }) {
  return <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{roster.map((id) => <div key={id} className={cn("flex flex-col items-center gap-2 rounded-xl border p-4", ready.includes(id) && "border-teal/60 bg-teal/5")}><Avatar id={id} size={56} /><p className="text-sm font-semibold">{id === me.id ? "You" : byId(id).name}</p><span className={cn("text-xs", ready.includes(id) ? "text-teal" : "text-muted-foreground")}>{ready.includes(id) ? "READY" : "waiting…"}</span></div>)}</div>;
}
export function BattleCountdown({ label, left, urgent = false }: { label: string; left: number; urgent?: boolean }) {
  return <div><p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p><p className={cn("font-display text-5xl font-bold tabular-nums", urgent && left < 60 ? "text-coral" : "text-foreground")}>{fmt(left)}</p></div>;
}
export function BattleRating({ own, value, onChange }: { own: boolean; value?: number; onChange: (score: number) => void }) {
  if (own) return <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">You can't rate your own entry.</p>;
  return <div className="flex gap-2" role="radiogroup" aria-label="Rating">{[1, 2, 3, 4, 5].map((score) => <Button key={score} variant="outline" size="icon" role="radio" aria-checked={value === score} aria-label={`${score} stars`} onClick={() => onChange(score)} className={cn("h-11 w-11", (value ?? 0) >= score ? "border-gold bg-gold/15 text-gold" : "text-muted-foreground")}><Star className={cn("h-5 w-5", (value ?? 0) >= score && "fill-current")} /></Button>)}</div>;
}