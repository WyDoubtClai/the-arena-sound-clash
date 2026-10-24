import { beats, type Beat } from "./data";

export const ARTIST_ROSTER = ["blaze", "novarae", "lyrick", "miasoul", "lexivibes", "verse", "amira", "juno"];
export const ARTIST_STAGES = ["Waiting Room", "Crate Draw", "Beat & Prompt Reveal", "15-Minute Creation", "3-Minute Upload", "Listen & Judge", "Results"];
export const ARTIST_DURATIONS: Record<number, number> = { 1: 120, 3: 900, 4: 180 };
export const PERFORMANCE_LIMIT = 60;
export const DEMO_SPEED = 30;
export const UPLOAD_LIMITS = [3, 10, 30] as const;
export const PROMPT = "After midnight: turn a setback into your next chapter.";
export const BALLOT_SEED = 2042;
export const seconds = (value: string) => value.split(":").reduce((total, part) => total * 60 + Number(part), 0);
export const segmentBounds = (beat: Beat) => beat.segment.split("–").map(seconds);

export function eligibleBeats(pool: Beat[]) {
  return pool.filter((beat) => {
    const [start, end] = segmentBounds(beat);
    return Number.isFinite(start) && Number.isFinite(end) && end - start === PERFORMANCE_LIMIT && start >= 0 && end <= seconds(beat.duration);
  });
}

// Seeded pseudorandom draws and tie selection are repeatable for this demo room.
export function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
}
export function drawBeats(pool = beats, seed = BALLOT_SEED) {
  const shuffled = [...eligibleBeats(pool)];
  const random = seededRandom(seed);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, 4);
}

export function closeBallot(choices: Beat[], userVote: string | null, seed = BALLOT_SEED) {
  // The seven simulated artists vote A, B, B, C, C, D, A, in roster order.
  const simulated = [0, 1, 1, 2, 2, 3, 0].map((index, i) => ({ artist: ARTIST_ROSTER[i + 1], beatId: choices[index]?.id }));
  const counts = choices.map((beat) => ({ beat, count: simulated.filter((vote) => vote.beatId === beat.id).length + Number(userVote === beat.id) }));
  const max = Math.max(...counts.map((row) => row.count));
  const tied = counts.filter((row) => row.count === max);
  const winner = tied[Math.floor(seededRandom(seed)() * tied.length)]?.beat;
  return { counts, simulated, winner, tied: tied.length > 1, total: counts.reduce((sum, row) => sum + row.count, 0) };
}
export function canRate(entryId: string, userId: string) { return entryId !== userId; }
export function rankArtists(ratings: Record<number, number>) {
  return ARTIST_ROSTER.map((id, i) => {
    const scores = Array.from({ length: 7 }, (_, judge) => 3 + ((i * 3 + judge * 2) % 5) * 0.45);
    if (canRate(id, ARTIST_ROSTER[0]) && ratings[i]) scores.push(ratings[i]);
    return { id, avg: scores.reduce((sum, score) => sum + score, 0) / scores.length };
  }).sort((a, b) => b.avg - a.avg);
}
// ---- Formats, shared 3-minute upload window, exclusions ----
export type BattleFormat = "creation" | "song";
export const FORMAT_LABEL: Record<BattleFormat, string> = { creation: "15-Minute Creation Battle", song: "Song-for-Song Quick Battle" };
export const SONG_STAGES = ["Waiting Room", "3-Minute Upload", "Listen & Judge", "Results"];
export const stagesFor = (format: BattleFormat) => (format === "creation" ? ARTIST_STAGES : SONG_STAGES);
export const UPLOAD_WINDOW = 180;
export const ballotLabel = (count: number, total: number) => (count > total / 2 ? "Majority winner" : "Plurality winner");

/** Seconds into the upload window when each simulated artist finishes; null = never submits. */
export function uploadSchedule(oneMisses: boolean): Record<string, number | null> {
  const times = [14, 26, 37, 48, 62, 81, 104];
  return Object.fromEntries(ARTIST_ROSTER.slice(1).map((id, i) => [id, oneMisses && i === 6 ? null : times[i]]));
}
export type UploadStatus = "Waiting" | "Uploading" | "Submitted" | "Missed Deadline";
export function uploadStatus(at: number | null | undefined, elapsed: number, closed: boolean): UploadStatus {
  if (at != null && elapsed >= at) return "Submitted";
  if (closed) return "Missed Deadline";
  return at != null && elapsed >= at - 10 ? "Uploading" : "Waiting";
}
/** Valid submitters at a moment in the window, in roster order. The local user counts only after a validated file. */
export function submittedIds(schedule: Record<string, number | null>, elapsed: number, userSubmitted: boolean) {
  return ARTIST_ROSTER.filter((id, i) => (i === 0 ? userSubmitted : uploadStatus(schedule[id], elapsed, false) === "Submitted"));
}
export const shouldCloseUpload = (submitted: number, left: number) => submitted === ARTIST_ROSTER.length || left <= 0;

const AUDIO_EXT = /\.(wav|mp3|m4a|aac|ogg|flac)$/i;
export function validateAudioFile(file: { name: string; type: string; size: number }, format: BattleFormat, durationSec?: number) {
  if (!file.size) return "That file is empty.";
  if (!file.type.startsWith("audio/") && !AUDIO_EXT.test(file.name)) return "Unsupported file. Choose WAV, MP3, M4A, AAC, OGG or FLAC.";
  if (format === "creation" && durationSec != null && durationSec > PERFORMANCE_LIMIT + 0.5) return "Creation entries are limited to 60 seconds.";
  return null;
}

/** Scores only valid entries; missing submissions receive no score. Ratings are keyed by roster index. */
export function rankEntries(ratings: Record<number, number>, entries: string[]) {
  return rankArtists(ratings).filter((row) => entries.includes(row.id));
}
