export type Stage = 0 | 1 | 2 | 3 | 4 | 5;
export const durations = { 2: 900, 3: 180 };
type Progress = {
  uploaded: string | null;
  index: number;
  ratings: Record<number, number>;
  downloaded: boolean;
};
export type ClockState = {
  stage: Stage;
  left: number;
  until: number | null;
  speed: 1 | 30;
  revealedKitId: string | null;
  progress?: Progress;
};
export type ClockAction =
  | { type: "kit-revealed"; kitId: string; now: number }
  | { type: "advance" | "tick"; from: Stage; now: number }
  | { type: "speed"; speed: 1 | 30; now: number }
  | { type: "reset"; now: number }
  | { type: "restore"; clock: ClockState };

const timed = (stage: Stage): stage is 2 | 3 => stage === 2 || stage === 3;
export const clockAt = (stage: Stage, speed: 1 | 30 = 30, now = Date.now()): ClockState => ({
  stage,
  speed,
  revealedKitId: null,
  left: timed(stage) ? durations[stage] : 0,
  until: timed(stage) ? now + (durations[stage] * 1000) / speed : null,
});

/** Absolute deadlines prevent throttling, duplicate ticks, or navigation granting more time. */
export function elapsedClock(state: ClockState, now: number): ClockState {
  let { stage, until } = state;
  while (timed(stage) && until !== null && now >= until) {
    stage = stage === 2 ? 3 : 4;
    until = stage === 3 ? until + (durations[3] * 1000) / state.speed : null;
  }
  return {
    ...state,
    stage,
    until,
    left: until === null ? 0 : Math.max(0, Math.ceil(((until - now) * state.speed) / 1000)),
  };
}

export function clockReducer(state: ClockState, action: ClockAction): ClockState {
  if (action.type === "restore") return action.clock;
  if (action.type === "reset") return clockAt(0, state.speed, action.now);
  if (action.type === "kit-revealed") {
    if (!action.kitId.trim() || state.revealedKitId || state.stage >= 2) return state;
    // The revealed kit and its one creation deadline are committed together.
    return { ...clockAt(2, state.speed, action.now), revealedKitId: action.kitId };
  }
  if (action.type === "speed") {
    const current = elapsedClock(state, action.now);
    return {
      ...current,
      speed: action.speed,
      until:
        current.until === null
          ? null
          : Math.floor(action.now + ((current.until - action.now) * current.speed) / action.speed),
    };
  }
  if (action.from !== state.stage) return state;
  if (action.type === "advance") {
    // Advancing a pre-reveal phase must never start creation without an actual kit reveal.
    if (state.stage === 1) return state;
    return {
      ...clockAt(Math.min(5, state.stage + 1) as Stage, state.speed, action.now),
      revealedKitId: state.revealedKitId,
    };
  }
  return elapsedClock(state, action.now);
}

const KEY = "arena-producer-gauntlet-clock-v1";
let memory: ClockState | null = null;
export function saveClock(clock: ClockState) {
  memory = clock;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(clock));
  } catch {
    /* Navigation still works in memory when browser storage is blocked. */
  }
}
export function readClock(now = Date.now()): ClockState | null {
  let value: unknown;
  let text: string | null;
  try {
    text = window.sessionStorage.getItem(KEY);
  } catch {
    return memory ? elapsedClock(memory, now) : null;
  }
  try {
    value = JSON.parse(text ?? "null");
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const v = value as ClockState;
  if (
    !Number.isInteger(v.stage) ||
    v.stage < 0 ||
    v.stage > 5 ||
    (v.speed !== 1 && v.speed !== 30) ||
    (v.revealedKitId !== null && typeof v.revealedKitId !== "string") ||
    (timed(v.stage) ? typeof v.until !== "number" || !Number.isFinite(v.until) : v.until !== null)
  )
    return null;
  const p = v.progress;
  const validProgress =
    p &&
    typeof p === "object" &&
    Number.isInteger(p.index) &&
    p.index >= 0 &&
    p.index < 8 &&
    (p.uploaded === null || typeof p.uploaded === "string") &&
    typeof p.downloaded === "boolean" &&
    p.ratings &&
    typeof p.ratings === "object" &&
    !Array.isArray(p.ratings) &&
    Object.entries(p.ratings).every(
      ([id, score]) => /^[0-7]$/.test(id) && Number.isInteger(score) && score >= 1 && score <= 5,
    );
  return elapsedClock(
    {
      stage: v.stage,
      speed: v.speed,
      revealedKitId: v.revealedKitId,
      until: v.until,
      left: 0,
      ...(validProgress ? { progress: { ...p, ratings: { ...p.ratings } } } : {}),
    },
    now,
  );
}
