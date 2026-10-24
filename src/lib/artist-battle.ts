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