import { describe, expect, it } from "vitest";
import { awardReward, canDownloadReward, claimReward, newBattleId, parseVault, qualifiesForReward, reservedBeatIds, rewardId, rewardsFor, type VaultReward } from "@/lib/beat-vault";
import { drawBeats, seconds, segmentBounds } from "@/lib/artist-battle";
import { beats } from "@/lib/data";
import { renderWav, sliceWav } from "@/lib/synth";

const beat = beats.find((b) => b.id === "b3")!; // Sunday Vibes, giveaway
const reward = (battleId = "aqb-1"): VaultReward => ({ id: rewardId(battleId, beat.id), battleId, battleName: "Artist Quick Battle #2042", artistId: "blaze", beatId: beat.id, beatTitle: beat.title, producer: beat.producer, awardedAt: "2026-10-24T00:00:00Z", status: "awarded", seed: beat.seed, seconds: seconds(beat.duration) });

describe("beat vault rewards", () => {
  it("only a first-place creation winner on a giveaway beat qualifies", () => {
    expect(qualifiesForReward("creation", beat, "blaze", "blaze")).toBe(true);
    expect(qualifiesForReward("creation", beat, "novarae", "blaze")).toBe(false);
    expect(qualifiesForReward("song", beat, "blaze", "blaze")).toBe(false);
    expect(qualifiesForReward("creation", { giveaway: false }, "blaze", "blaze")).toBe(false);
  });
  it("awarding the same battle twice creates exactly one awaiting reward", () => {
    const list = awardReward(awardReward([], reward()), reward());
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe("awarded");
  });
  it("separate battles get separate ids, but a reserved beat is never awarded twice", () => {
    expect(newBattleId(1, 0.1)).not.toBe(newBattleId(2, 0.1));
    expect(rewardId("aqb-1", "b3")).not.toBe(rewardId("aqb-2", "b3"));
    expect(awardReward([reward("aqb-1")], reward("aqb-2"))).toHaveLength(1);
  });
  it("only the winning artist can claim or download", () => {
    const list = [reward()];
    expect(canDownloadReward(list[0], "tonemadelt")).toBe(false);
    expect(claimReward(list, list[0].id, "tonemadelt")[0].status).toBe("awarded");
    expect(claimReward(list, list[0].id, "blaze")[0].status).toBe("claimed");
    expect(rewardsFor(list, "tonemadelt")).toHaveLength(0);
  });
  it("awarded beats leave future draws immediately", () => {
    const reserved = reservedBeatIds([reward()]);
    const draw = drawBeats(beats.filter((b) => !reserved.has(b.id)));
    expect(draw.map((b) => b.id)).not.toContain("b3");
  });
  it("survives a storage round trip and ignores corrupt data", () => {
    expect(parseVault(JSON.stringify([reward()]))[0].id).toBe("aqb-1:b3");
    expect(parseVault("{oops")).toEqual([]);
  });
  it("60s excerpt equals the matching PCM samples of the full WAV after the 44-byte header", () => {
    const full = renderWav(beat.seed, seconds(beat.duration));
    expect(new Uint8Array(renderWav(beat.seed, seconds(beat.duration)))).toEqual(new Uint8Array(full)); // deterministic regeneration
    const [start, end] = segmentBounds(beat);
    const cut = sliceWav(full, start, end - start);
    const sr = new DataView(full).getUint32(24, true);
    expect(cut.byteLength).toBe(44 + 60 * sr * 2);
    expect(new Uint8Array(cut, 44)).toEqual(new Uint8Array(full, 44 + start * sr * 2, 60 * sr * 2));
  });
});
