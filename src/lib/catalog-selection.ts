/** Phase 1 catalog selection rules; ownership here is a demo guard, not server authorization. */
export type CatalogItem = {
  id: string;
  ownerId: string;
  title: string;
  seconds: number;
  artwork: string;
  audio: { kind: "demo"; seed: number } | { kind: "url"; src: string } | null;
};

export type CatalogSelection = {
  battleId: string;
  participantId: string;
  itemId: string;
  item: CatalogItem;
};

export function playableCatalogItem(item: CatalogItem) {
  return (
    Number.isFinite(item.seconds) &&
    item.seconds > 0 &&
    !!item.audio &&
    (item.audio.kind === "demo" ? Number.isFinite(item.audio.seed) : !!item.audio.src.trim())
  );
}

/** Snapshot once; callers cannot replace a lock or submit after the window closes. */
export function lockCatalogItem(
  previous: CatalogSelection | null,
  item: CatalogItem,
  battleId: string,
  participantId: string,
  open: boolean,
): CatalogSelection | null {
  if (
    previous ||
    !open ||
    !battleId ||
    !item.id ||
    item.ownerId !== participantId ||
    !playableCatalogItem(item)
  )
    return previous;
  return {
    battleId,
    participantId,
    itemId: item.id,
    item: { ...item, audio: item.audio && { ...item.audio } },
  };
}

export function catalogSelectionStatus(
  locked: boolean,
  elapsed: number,
  at: number | null | undefined,
  closed: boolean,
) {
  if (locked) return "Locked In";
  if (closed) return "Missed Deadline";
  return at != null && elapsed >= at - 10 ? "Selecting" : "Waiting";
}
