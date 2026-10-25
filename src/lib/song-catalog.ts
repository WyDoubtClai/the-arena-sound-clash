import { tracks, byId } from "./data";
import type { Track } from "./player";
import type { CatalogItem, CatalogSelection } from "./catalog-selection";
import artwork from "@/assets/studio-banner.jpg";

// Explicit ownership IDs, independent of display names and filenames.
const owners: Record<string, string> = {
  t1: "novarae",
  t2: "lyrick",
  t3: "miasoul",
  t4: "dretracks",
  t5: "blaze",
  t6: "blaze",
  t7: "blaze",
};
export type ProfileSong = CatalogItem & { plays: string; likes: string };
export const profileSongs: ProfileSong[] = [
  ...tracks.map((track) => ({
    id: track.id,
    ownerId: owners[track.id],
    title: track.title,
    artwork,
    // Existing profile audio is a 30s synthesized preview, not the fictional full-song duration.
    seconds: 30,
    audio: { kind: "demo" as const, seed: track.seed },
    plays: track.plays,
    likes: track.likes,
  })),
  ...["lexivibes", "verse", "amira", "juno"].map((ownerId, i) => ({
    id: `song-demo-${ownerId}`,
    ownerId,
    title: `${byId(ownerId).name} Demo Song`,
    artwork,
    seconds: 30,
    audio: { kind: "demo" as const, seed: 401 + i },
    plays: "0",
    likes: "0",
  })),
];
export const songsFor = (ownerId: string) =>
  profileSongs.filter((song) => song.ownerId === ownerId);

export function songTrack(item: CatalogItem, battleId: string): Track {
  return {
    id: `catalog:${battleId}:${item.ownerId}:${item.id}`,
    title: item.title,
    artist: byId(item.ownerId).name,
    seconds: item.seconds,
    seed: item.audio?.kind === "demo" ? item.audio.seed : 0,
    ...(item.audio?.kind === "url" ? { src: item.audio.src } : {}),
  };
}
export const selectedSongTrack = (selection: CatalogSelection) =>
  songTrack(selection.item, selection.battleId);
