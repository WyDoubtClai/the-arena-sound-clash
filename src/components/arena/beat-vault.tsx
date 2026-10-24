import { CheckCircle2, Disc3, Download, Gift, RotateCcw } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { byId, me } from "@/lib/data";
import { canDownloadReward, downloadRewardFile, rewardsFor, useVault } from "@/lib/beat-vault";
import { fmt } from "@/lib/player";
import { Button } from "@/components/ui/button";

/** Profile Beat Vault: only locally earned rewards; download controls only for the winning (local demo) account. */
export function BeatVault({ profileId }: { profileId: string }) {
  const vault = useVault();
  const owner = profileId === me.id;
  const list = rewardsFor(vault.list, profileId);
  const awaiting = list.filter((r) => r.status === "awarded").length;
  const hue = (id: string) => byId(id).hue;
  return <section aria-label="Beat Vault" className="space-y-4 rounded-xl border bg-surface/60 p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h2 className="flex items-center gap-2 font-display text-2xl font-bold"><Disc3 className="text-violet" />{owner ? "My Beat Vault" : `${byId(profileId).name}'s Beat Vault`}</h2><p className="text-sm text-muted-foreground">Your collection of competition rewards</p></div>
      <span className="rounded-full bg-muted px-3 py-1 text-xs">Demo Preview</span>
    </div>
    {!owner ? <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Beat Vault rewards and downloads are private to the winning artist. (Phase 1: this is browser-local demo protection, not production security.)</p> : <>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-surface p-4"><p className="text-sm text-muted-foreground">Beats Earned</p><p className="font-display text-3xl font-bold">{list.length}</p></div>
        <div className="rounded-lg bg-surface p-4"><p className="text-sm text-muted-foreground">Awaiting Claim</p><p className="font-display text-3xl font-bold text-teal">{awaiting}</p></div>
      </div>
      {list.length === 0 ? <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground"><p>No rewards yet. Win first place in a Creation Battle on a Winner Giveaway or Buy It or Win It beat to earn its full instrumental.</p><Button asChild variant="outline" size="sm" className="mt-3"><Link to="/artist-quick-battle">Enter Artist Quick Battle</Link></Button></div>
        : <ul className="divide-y">{list.map((r) => <li key={r.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
          <div className="h-20 w-20 shrink-0 rounded-xl" aria-hidden style={{ background: `radial-gradient(circle at 30% 30%, hsl(${hue(r.producer)} 90% 60% / .7), transparent 65%), linear-gradient(135deg, hsl(${(hue(r.producer) + 40) % 360} 70% 25%), var(--background))` }} />
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="truncate font-display text-lg font-semibold">{r.beatTitle}</h3>
            <p className="text-sm text-muted-foreground">{byId(r.producer).name} · {r.battleName} · {new Date(r.awardedAt).toLocaleDateString()} · {fmt(r.seconds)} full length</p>
            <p className={r.status === "claimed" ? "flex items-center gap-1 text-sm text-teal" : "flex items-center gap-1 text-sm text-gold"}>{r.status === "claimed" ? <><CheckCircle2 className="h-4 w-4" />Claimed</> : <><Gift className="h-4 w-4" />Awaiting Claim</>}</p>
            {canDownloadReward(r, me.id) && <Button className="mt-1 w-full" onClick={async () => { if (await downloadRewardFile(r, me.id)) vault.claim(r.id, me.id); else toast.error("The full beat couldn't be prepared in this browser."); }}>{r.status === "claimed" ? <><Download />Re-download Full Beat</> : <><Gift />Claim & Download Full Beat</>}</Button>}
          </div>
        </li>)}</ul>}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
        <p>Phase 1 demo: rewards are saved in this browser only. Downloads regenerate the same full-length demo audio. No ownership, exclusive rights or commercial license.</p>
        {list.length > 0 && <Button variant="ghost" size="sm" onClick={() => { vault.reset(); toast.success("Demo giveaway awards and claims reset"); }}><RotateCcw />Demo Reset</Button>}
      </div>
    </>}
  </section>;
}
