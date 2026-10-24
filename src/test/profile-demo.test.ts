import { describe, expect, it } from "vitest";
import { beats } from "@/lib/data";
import { canEditProfile, canFeatureAchievement, isCompetitionEligible, profileListing, profileRoles, winPercentage } from "@/lib/profile-demo";

describe("Profile demo rules", () => {
  it("keeps editing owner-only across all previews", () => {
    expect(canEditProfile("blaze")).toBe(true);
    expect(canEditProfile("tonemadelt")).toBe(false);
    expect(canEditProfile("judgeraye")).toBe(false);
  });
  it("retains both artist and producer identities for Blaze", () => {
    expect(profileRoles.blaze).toEqual(["Artist", "Producer"]);
  });
  it("excludes For Sale-only listings from competition", () => {
    expect(isCompetitionEligible("For Sale")).toBe(false);
    expect(isCompetitionEligible("Competition Only")).toBe(true);
    expect(isCompetitionEligible("Winner Giveaway")).toBe(true);
    expect(isCompetitionEligible("Buy It or Win It")).toBe(true);
  });
  it("uses the same fictional listing meanings as the current Crate", () => {
    expect(beats.slice(0, 4).map(profileListing)).toEqual(["Winner Giveaway", "For Sale", "Winner Giveaway", "For Sale"]);
    expect(profileListing(beats[6])).toBe("Competition Only");
    expect(profileListing(beats[7])).toBe("Buy It or Win It");
  });
  it("does not allow locked achievements to become featured", () => {
    expect(canFeatureAchievement("blaze", "champion")).toBe(false);
    expect(canFeatureAchievement("blaze", "streak")).toBe(true);
    expect(canFeatureAchievement("judgeraye", "first")).toBe(false);
    expect(canFeatureAchievement("judgeraye", "community")).toBe(true);
  });
  it("calculates win percentage using all battles, including draws", () => {
    expect(winPercentage([18, 6, 2])).toBe(69);
    expect(winPercentage([0, 0, 0])).toBe(0);
  });
});
