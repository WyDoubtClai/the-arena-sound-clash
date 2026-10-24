export type Role = "Artist" | "Producer" | "Engineer" | "Judge" | "Listener";

export type Person = { id: string; name: string; role: Role; level: number; hue: number; xp: number; rep: number; record: [number, number, number]; city?: string; followers?: string };

export const people: Person[] = [
  { id: "blaze", name: "Blaze", role: "Artist", level: 12, hue: 270, xp: 2120, rep: 812, record: [18, 6, 2], city: "Atlanta, GA", followers: "2.4K" },
  { id: "tonemadelt", name: "ToneMadelt", role: "Producer", level: 15, hue: 200, xp: 8200, rep: 946, record: [28, 12, 3], city: "Atlanta, GA", followers: "2.4K" },
  { id: "novarae", name: "Nova Rae", role: "Artist", level: 18, hue: 330, xp: 2850, rep: 1210, record: [24, 4, 1], followers: "24.5K" },
  { id: "lyrick", name: "Lyric K", role: "Artist", level: 16, hue: 30, xp: 2480, rep: 1033, record: [20, 7, 2], followers: "18.1K" },
  { id: "dretracks", name: "DreTracks", role: "Producer", level: 17, hue: 160, xp: 2310, rep: 990, record: [19, 5, 4], followers: "11.9K" },
  { id: "miasoul", name: "Mia Soul", role: "Artist", level: 14, hue: 300, xp: 1980, rep: 701, record: [14, 5, 1], followers: "12.4K" },
  { id: "kayobeats", name: "KayoBeats", role: "Producer", level: 13, hue: 50, xp: 1760, rep: 655, record: [12, 4, 0], followers: "3.1K" },
  { id: "soundmason", name: "SoundMason", role: "Engineer", level: 18, hue: 180, xp: 1620, rep: 1102, record: [10, 3, 0], followers: "3.8K" },
  { id: "kairo", name: "Kairo", role: "Producer", level: 15, hue: 10, xp: 1540, rep: 540, record: [9, 6, 1], followers: "1.9K" },
  { id: "lexivibes", name: "Lexi Vibes", role: "Artist", level: 12, hue: 340, xp: 1400, rep: 480, record: [8, 5, 0], followers: "4.2K" },
  { id: "judgeraye", name: "Judge Raye", role: "Judge", level: 20, hue: 45, xp: 3120, rep: 1450, record: [0, 0, 0], followers: "8.8K" },
  { id: "flexmadelt", name: "FlexMadelt", role: "Producer", level: 11, hue: 120, xp: 1210, rep: 390, record: [7, 7, 1], followers: "2.0K" },
  { id: "echo", name: "EchoListens", role: "Listener", level: 6, hue: 220, xp: 640, rep: 220, record: [0, 0, 0], followers: "310" },
  { id: "verse", name: "Verse", role: "Artist", level: 9, hue: 190, xp: 980, rep: 320, record: [5, 3, 1] },
  { id: "amira", name: "Amira", role: "Artist", level: 11, hue: 85, xp: 1320, rep: 450, record: [7, 2, 0] },
  { id: "juno", name: "Juno", role: "Artist", level: 10, hue: 250, xp: 1110, rep: 380, record: [6, 4, 0] },
];
export const me = people[0];
export const byId = (id: string) => people.find((p) => p.id === id)!;

export const genres = ["Hip-Hop", "R&B", "Trap", "Pop", "Drill", "Afrobeats", "Lo-Fi", "Electronic", "Soul"];

export type Beat = { id: string; title: string; producer: string; genre: string; bpm: number; key: string; duration: string; seed: number; segment: string; giveaway: boolean; plays: string };
export const beats: Beat[] = [
  { id: "b1", title: "Midnight Drive", producer: "tonemadelt", genre: "Trap", bpm: 140, key: "F# min", duration: "2:34", seed: 11, segment: "0:42–1:42", giveaway: true, plays: "3.2K" },
  { id: "b2", title: "City Lights", producer: "dretracks", genre: "R&B", bpm: 92, key: "Bb maj", duration: "2:18", seed: 12, segment: "0:30–1:30", giveaway: false, plays: "1.8K" },
  { id: "b3", title: "Sunday Vibes", producer: "kayobeats", genre: "Soul", bpm: 84, key: "D maj", duration: "3:01", seed: 13, segment: "1:05–2:05", giveaway: true, plays: "4.1K" },
  { id: "b4", title: "Dark Matter", producer: "kairo", genre: "Drill", bpm: 144, key: "C min", duration: "2:50", seed: 14, segment: "0:15–1:15", giveaway: false, plays: "2.6K" },
  { id: "b5", title: "Golden Hour", producer: "flexmadelt", genre: "Afrobeats", bpm: 104, key: "A min", duration: "3:12", seed: 15, segment: "0:50–1:50", giveaway: true, plays: "6.7K" },
  { id: "b6", title: "Neon Rain", producer: "tonemadelt", genre: "Lo-Fi", bpm: 78, key: "E min", duration: "2:05", seed: 16, segment: "0:20–1:20", giveaway: false, plays: "980" },
  { id: "b7", title: "Pressure", producer: "dretracks", genre: "Hip-Hop", bpm: 96, key: "G min", duration: "2:48", seed: 17, segment: "0:35–1:35", giveaway: false, plays: "18.1K" },
  { id: "b8", title: "Velvet Static", producer: "kayobeats", genre: "Electronic", bpm: 124, key: "B min", duration: "3:30", seed: 18, segment: "1:10–2:10", giveaway: true, plays: "2.2K" },
];

export const tracks = [
  { id: "t1", title: "Late Nights", artist: "Nova Rae", seed: 21, plays: "24.5K", likes: "1.2K", dur: "3:24" },
  { id: "t2", title: "Pressure", artist: "Lyric K", seed: 22, plays: "18.1K", likes: "892", dur: "2:48" },
  { id: "t3", title: "Golden Hour", artist: "Mia Soul", seed: 23, plays: "12.4K", likes: "654", dur: "3:17" },
  { id: "t4", title: "No Limits", artist: "DreTracks", seed: 24, plays: "11.9K", likes: "601", dur: "2:56" },
  { id: "t5", title: "City Dreams", artist: "Blaze", seed: 25, plays: "1.2K", likes: "342", dur: "3:24" },
  { id: "t6", title: "Higher Ground", artist: "Blaze", seed: 26, plays: "1.9K", likes: "421", dur: "3:18" },
  { id: "t7", title: "Late Night Thoughts", artist: "Blaze", seed: 27, plays: "3.4K", likes: "667", dur: "2:48" },
];

export type PostCat = "Discussions" | "Questions" | "Collabs" | "Battles" | "Feedback";
export type Post = { id: string; author: string; cat: PostCat; time: string; body: string; likes: number; comments: number; audio?: { title: string; seed: number } };
export const posts: Post[] = [
  { id: "p1", author: "kairo", cat: "Feedback", time: "2h", body: "Just cooked up this sample pack. What y'all think? 🔥 Free to use for non-profit.", likes: 128, comments: 42, audio: { title: "Midnight Textures (Sample Pack)", seed: 31 } },
  { id: "p2", author: "lexivibes", cat: "Questions", time: "3h", body: "What's the best way to balance writing and recording? Drop your routines below 👇", likes: 76, comments: 63 },
  { id: "p3", author: "soundmason", cat: "Discussions", time: "4h", body: "Let's talk mixing vocals. What's your vocal chain looking like in 2026?", likes: 54, comments: 37 },
  { id: "p4", author: "dretracks", cat: "Collabs", time: "5h", body: "Looking for an R&B singer for a slow jam I'm finishing. 92 BPM, Bb major. DM me.", likes: 41, comments: 18, audio: { title: "Slow Jam Draft v3", seed: 32 } },
  { id: "p5", author: "novarae", cat: "Battles", time: "6h", body: "Who's pulling up to Friday Night Song Battle? I'm bringing the heat this week 🎤", likes: 212, comments: 88 },
  { id: "p6", author: "tonemadelt", cat: "Feedback", time: "8h", body: "Flipped a 70s soul sample for the Gauntlet. Rate the drums honestly.", likes: 97, comments: 29, audio: { title: "Soul Flip — Gauntlet Entry", seed: 33 } },
  { id: "p7", author: "echo", cat: "Discussions", time: "1d", body: "As a listener, judging battles has made me hear music completely differently. Anyone else?", likes: 63, comments: 22 },
];

export const events = [
  { id: "e1", title: "Friday Night Song Battle", type: "Song Battles", meta: "8 Artists • 3 Rounds • Open Genre", inHours: 14, roster: ["novarae", "lyrick", "miasoul", "blaze", "lexivibes"] },
  { id: "e2", title: "Producer Showdown", type: "Beat Battles", meta: "8 Producers • 15 Min • Hip-Hop", inHours: 38, roster: ["tonemadelt", "dretracks", "kayobeats", "kairo"] },
  { id: "e3", title: "R&B Cypher", type: "Lyric Battles", meta: "6 Artists • 2 Rounds • R&B", inHours: 62, roster: ["miasoul", "novarae", "lexivibes"] },
  { id: "e4", title: "The Arena Tournament", type: "Tournaments", meta: "16 Artists • Song Battle • Hip-Hop", inHours: 140, roster: ["lyrick", "blaze", "novarae", "miasoul", "lexivibes", "echo"] },
  { id: "e5", title: "Producers Only: Sample Flip", type: "Beat Battles", meta: "8 Producers • 15 Min • Soul", inHours: 90, roster: ["flexmadelt", "kairo", "tonemadelt"] },
];

export const activity = [
  "🔥 Nova Rae won Song-for-Song vs Lyric K (4.6★)",
  "🎛️ ToneMadelt's 'Midnight Drive' was picked in a Crate Draw",
  "⚡ Producer Quick Battle #2041 just went live — 8/8 ready",
  "🏆 DreTracks reached Level 17",
  "🎤 Mia Soul joined Friday Night Song Battle",
  "⭐ Judge Raye rated 120 entries this week",
  "💿 KayoBeats uploaded 'Velvet Static' to The Crate",
];

export const trendingTopics = ["Mixing Tips", "Collab Requests", "16-Bar Challenge", "Beat Feedback", "Studio Setup", "Lyric Writing", "Upcoming Battles"];
