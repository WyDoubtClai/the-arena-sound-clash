import { beats, byId, type Role } from "@/lib/data";

export type ProfileId = "blaze" | "tonemadelt" | "judgeraye";
export const profileIds: ProfileId[] = ["blaze", "tonemadelt", "judgeraye"];
export const canEditProfile = (id: ProfileId) => id === "blaze";
export const profileRoles: Record<ProfileId, Role[]> = {
  blaze: ["Artist", "Producer"], tonemadelt: ["Producer", "Engineer"], judgeraye: ["Judge", "Listener"],
};
export type ListingType = "Competition Only" | "Winner Giveaway" | "For Sale" | "Buy It or Win It";
// Mirrors the existing Crate's fictional label mapping, without changing its flow.
export function profileListing(beat: (typeof beats)[number]): ListingType {
  if (beat.giveaway) return beat.seed % 2 === 0 ? "Buy It or Win It" : "Winner Giveaway";
  return beat.seed % 2 === 0 ? "For Sale" : "Competition Only";
}
export const isCompetitionEligible = (type: ListingType) => type !== "For Sale";
export const winPercentage = (record: readonly number[]) => {
  const entered = record.reduce((sum, n) => sum + n, 0);
  return entered ? Math.round((record[0] / entered) * 100) : 0;
};
export const competitive = {
  blaze: { current: 2, best: 5, tournaments: 1, rank: "#24", producerRecord: [7, 3, 1] as const, producerXp: 940, producerRank: "#68" },
  tonemadelt: { current: 3, best: 7, tournaments: 2, rank: "#12", producerRecord: byId("tonemadelt").record, producerXp: byId("tonemadelt").xp, producerRank: "#12" },
};
export const crateMetrics = {
  blaze: { uploaded: 4, voteAppearances: 14, selectionsWon: 5, battleUses: 5, artistWins: 3, gifts: 1, sold: 2 },
  tonemadelt: { uploaded: 12, voteAppearances: 86, selectionsWon: 31, battleUses: 31, artistWins: 19, gifts: 8, sold: 14 },
};
export const achievementList = [
  { id: "first", title: "First Victory", detail: "A debut win in the Arena.", icon: "trophy" },
  { id: "streak", title: "Five-Win Streak", detail: "Five consecutive competition wins.", icon: "flame" },
  { id: "champion", title: "Gauntlet Champion", detail: "First place in a producer Gauntlet.", icon: "crown" },
  { id: "crate", title: "Crate Favorite", detail: "An instrumental selected by artists.", icon: "disc" },
  { id: "community", title: "Community Pillar", detail: "Thoughtful feedback and participation.", icon: "heart" },
] as const;
export const earnedAchievements: Record<ProfileId, readonly string[]> = {
  blaze: ["first", "streak", "crate"], tonemadelt: ["first", "streak", "champion", "crate"], judgeraye: ["community"],
};
export const canFeatureAchievement = (profile: ProfileId, achievement: string) => earnedAchievements[profile].includes(achievement);
export type Match = { name: string; format: string; against: string; result: string; date: string; xp?: number };
export const matchHistory: Record<ProfileId, Match[]> = {
  blaze: [
    { name: "Friday Night Showdown", format: "Song-for-Song", against: "Lyric K", result: "Win", date: "Oct 18, 2026", xp: 120 },
    { name: "One Beat, Eight Voices", format: "Artist Quick Battle", against: "7 artists · including Lexi Vibes", result: "1st / 8", date: "Oct 16, 2026", xp: 180 },
    { name: "After Hours", format: "Song-for-Song", against: "Nova Rae", result: "Loss", date: "Oct 12, 2026", xp: 40 },
    { name: "Soul Sessions", format: "Custom Room", against: "Mia Soul", result: "Draw", date: "Oct 10, 2026", xp: 60 },
    { name: "Sample Flip", format: "Producer Quick Battle", against: "7 producers · including Kairo", result: "1st / 8", date: "Oct 8, 2026", xp: 150 },
  ],
  tonemadelt: [
    { name: "The Midnight Gauntlet", format: "Producer Quick Battle", against: "7 producers · including DreTracks", result: "1st / 8", date: "Oct 19, 2026", xp: 180 },
    { name: "Soul Flip Invitational", format: "Producer Tournament", against: "15 producers", result: "1st / 16", date: "Oct 15, 2026", xp: 300 },
    { name: "Drum Theory", format: "Producer Quick Battle", against: "7 producers · including KayoBeats", result: "3rd / 8", date: "Oct 11, 2026", xp: 90 },
  ],
  judgeraye: [
    { name: "Friday Night Showdown", format: "Song-for-Song", against: "Blaze vs Lyric K", result: "Judged", date: "Oct 18, 2026" },
    { name: "The Midnight Gauntlet", format: "Producer Quick Battle", against: "8 producers", result: "Judged", date: "Oct 19, 2026" },
  ],
};