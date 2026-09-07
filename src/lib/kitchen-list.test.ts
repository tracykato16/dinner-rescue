import { describe, expect, it } from "vitest";

import {
  applySpokenUpdate,
  itemsFromInventory,
  itemsFromTranscript,
  removeUsedUp,
  transcriptFromItems,
} from "./kitchen-list";

describe("kitchen list", () => {
  const base = itemsFromTranscript("I've got chicken thighs, rice, carrots and Greek yoghurt");

  it("builds a list from a first transcript", () => {
    expect(base).toEqual(["chicken thighs", "rice", "carrots", "greek yoghurt"]);
    expect(transcriptFromItems(base)).toContain("rice");
  });

  it("adds new ingredients conversationally", () => {
    const next = applySpokenUpdate(base, "add sausages, broccoli and cheese");
    expect(next).toContain("sausages");
    expect(next).toContain("broccoli");
    expect(next).toContain("cheese");
    expect(next).toContain("rice");
  });

  it("removes what was used up and keeps what still remains", () => {
    const next = applySpokenUpdate(base, "used all the chicken thighs, still got the rice");
    expect(next).not.toContain("chicken thighs");
    expect(next).toContain("rice");
    expect(next).toContain("carrots");
  });

  it("handles 'get rid of' and 'no onion anymore' without re-adding", () => {
    const withOnion = applySpokenUpdate(base, "I've also got onion");
    expect(withOnion).toContain("onion");
    const next = applySpokenUpdate(withOnion, "get rid of the yoghurt, I don't have onion anymore");
    expect(next).not.toContain("onion");
    expect(next.some((i) => i.includes("yoghurt"))).toBe(false);
    expect(next).toContain("rice");
  });

  it("never stores water, and keeps herbs and spices as the user's wording", () => {
    const list = itemsFromTranscript("chicken, rice, water and all the herbs and spices");
    expect(list).not.toContain("water");
    expect(list).toContain("herbs and spices");
    expect(itemsFromInventory(["chicken", "water", "salt", "spices"], "chicken")).toEqual([
      "chicken",
      "salt",
      "herbs and spices",
    ]);
  });

  it("removes only ticked used-up items after cooking", () => {
    const next = removeUsedUp(base, ["chicken thighs"]);
    expect(next).not.toContain("chicken thighs");
    expect(next).toEqual(["rice", "carrots", "greek yoghurt"]);
    expect(removeUsedUp(base, [])).toEqual(base);
  });
});
