import { Avatar, Panel, PlayButton } from "./bits";
import { BattleCountdown } from "./battle-controls";
import { Button } from "@/components/ui/button";
import { ARTIST_ROSTER } from "@/lib/artist-battle";
import { byId, me } from "@/lib/data";
import { fmt } from "@/lib/player";
import {
  playableCatalogItem,
  type CatalogItem,
  type CatalogSelection,
} from "@/lib/catalog-selection";
import { songTrack } from "@/lib/song-catalog";

export function SongSelection({
  songs,
  battleId,
  left,
  candidateId,
  locked,
  statuses,
  onSelect,
  onLock,
}: {
  songs: CatalogItem[];
  battleId: string;
  left: number;
  candidateId: string | null;
  locked: CatalogSelection | null;
  statuses: Record<string, string>;
  onSelect: (id: string) => void;
  onLock: () => void;
}) {
  const available = songs.filter((song) => song.ownerId === me.id && playableCatalogItem(song));
  const closed = left <= 0 || !!locked;
  return (
    <section className="space-y-4" aria-label="Song selection">
      <h2 className="text-xl font-bold">Choose your profile song</h2>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <BattleCountdown label="Song selection closes in" left={left} urgent />
        <strong aria-live="polite">
          {Object.values(statuses).filter((s) => s === "Locked In").length} of 8 Locked In
        </strong>
      </div>
      <p className="text-sm text-muted-foreground">
        Choose one of your own songs, then lock it for this battle. All eight artists share three
        minutes. Missing selections are excluded; no song is chosen for you.
      </p>
      <p className="rounded-lg border border-gold/30 bg-gold/5 p-3 text-xs text-gold">
        Demo profile catalog · these are existing demo titles with playable 30-second synthesized
        audio, not stored user uploads or full recordings. Other artists use labeled demo catalog
        fixtures. Ranked records are not implemented.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ARTIST_ROSTER.map((id) => (
          <div
            key={id}
            aria-label={`${byId(id).name}: ${statuses[id]}`}
            className="flex items-center gap-2 rounded-lg border p-2"
          >
            <Avatar id={id} size={28} />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">
                {id === me.id ? "You" : byId(id).name}
              </p>
              <p className="text-[11px] text-muted-foreground">{statuses[id]}</p>
            </div>
          </div>
        ))}
      </div>
      {locked ? (
        <Panel className="border-teal/60">
          <p className="font-semibold text-teal">Locked In: {locked.item.title}</p>
          <p className="text-xs text-muted-foreground">
            This selection cannot be replaced during this battle.
          </p>
        </Panel>
      ) : (
        <>
          <div className="space-y-3" role="radiogroup" aria-label="Your profile songs">
            {available.map((song) => (
              <Panel key={song.id} className="flex flex-wrap items-center gap-3">
                <img
                  src={song.artwork}
                  alt={`${song.title} demo artwork`}
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-md object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{song.title}</p>
                  <p className="text-xs text-muted-foreground">{fmt(song.seconds)} · demo audio</p>
                </div>
                <PlayButton track={songTrack(song, `${battleId}:preview`)} />
                <button
                  type="button"
                  role="radio"
                  aria-label={`Select ${song.title}`}
                  aria-checked={candidateId === song.id}
                  disabled={closed}
                  onClick={() => onSelect(song.id)}
                  className="rounded-lg border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet disabled:opacity-50"
                >
                  {candidateId === song.id ? "Selected" : "Select"}
                </button>
              </Panel>
            ))}
          </div>
          {available.length === 0 && (
            <p role="status" className="text-sm text-muted-foreground">
              No playable songs in your profile catalog. You cannot enter this round without an
              eligible song.
            </p>
          )}
          <Button
            disabled={closed || !available.some((song) => song.id === candidateId)}
            onClick={onLock}
          >
            Lock selected song
          </Button>
        </>
      )}
    </section>
  );
}
