export const EXCERPT_SECONDS = 60;

export function maxExcerptStart(duration: number) {
  return Number.isFinite(duration) && duration >= EXCERPT_SECONDS
    ? Math.floor((duration - EXCERPT_SECONDS) * 100) / 100
    : 0;
}

export function excerptStart(value: number, duration: number) {
  return Math.min(
    maxExcerptStart(duration),
    Math.max(0, Number.isFinite(value) ? Math.round(value * 100) / 100 : 0),
  );
}

export function excerptTime(seconds: number) {
  const hundredths = Math.round(seconds * 100);
  return `${Math.floor(hundredths / 6000)}:${String(Math.floor(hundredths / 100) % 60).padStart(2, "0")}.${String(hundredths % 100).padStart(2, "0")}`;
}
