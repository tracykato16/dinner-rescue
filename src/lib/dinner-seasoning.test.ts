import { describe, expect, it } from "vitest";

import {
  hasVagueSeasoningProse,
  isGrounded,
  isSeasoningItem,
  isVagueQuantity,
  isVagueSeasoningName,
  transcriptStems,
} from "./dinner-grounding";
import { validateAgainstTranscript } from "./dinner-validate";
import type { DinnerOption } from "./dinner-types";

const BROAD = "chicken thighs, rice and all the herbs and spices you can think of";
const PLAIN = "chicken thighs, rice and some paprika";

function option(over: Partial<DinnerOption>): DinnerOption {
  return {
    id: "opt-1",
    name: "Paprika chicken and rice",
    description: "Simple tray chicken with rice.",
    minutes: 30,
    servings: 2,
    ingredients: [
      { item: "chicken thighs", quantity: "400 g" },
      { item: "rice", quantity: "1 cup" },
    ],
    steps: ["Rub the chicken thighs and roast until cooked through.", "Cook the rice."],
    ...over,
  };
}

const INVENTORY = ["chicken thighs", "rice", "herbs and spices"];

describe("vague seasoning wording is never shown", () => {
  it("flags vague names, quantities and prose", () => {
    for (const name of ["herbs", "mixed herbs", "spices", "seasoning", "dried herbs", "spice mix"]) {
      expect(isVagueSeasoningName(name), name).toBe(true);
    }
    for (const name of ["smoked paprika", "dried oregano", "black pepper", "ground cumin"]) {
      expect(isVagueSeasoningName(name), name).toBe(false);
    }
    expect(isVagueQuantity("to taste")).toBe(true);
    expect(isVagueQuantity("a sprinkle")).toBe(true);
    expect(isVagueQuantity("1 tsp")).toBe(false);
    expect(hasVagueSeasoningProse("season to taste and serve")).toBe(true);
    expect(hasVagueSeasoningProse("sprinkle of herbs over the top")).toBe(true);
    expect(hasVagueSeasoningProse("season with your herbs and spices")).toBe(true);
    expect(hasVagueSeasoningProse("stir in 1 tsp smoked paprika")).toBe(false);
  });

  it("rejects an option with a vague seasoning ingredient", () => {
    const out = validateAgainstTranscript(
      [
        option({
          ingredients: [
            { item: "chicken thighs", quantity: "400 g" },
            { item: "rice", quantity: "1 cup" },
            { item: "herbs and spices", quantity: "a sprinkle" },
          ],
        }),
      ],
      INVENTORY,
      BROAD,
    );
    expect(out.options).toHaveLength(0);
  });

  it("rejects an option whose steps say 'season to taste'", () => {
    const out = validateAgainstTranscript(
      [option({ steps: ["Roast the chicken thighs.", "Cook the rice and season to taste."] })],
      INVENTORY,
      BROAD,
    );
    expect(out.options).toHaveLength(0);
  });

  it("keeps an option that names specific dry seasonings with quantities", () => {
    const out = validateAgainstTranscript(
      [
        option({
          ingredients: [
            { item: "chicken thighs", quantity: "400 g" },
            { item: "rice", quantity: "1 cup" },
            { item: "smoked paprika", quantity: "1 tsp" },
            { item: "dried oregano", quantity: "1/2 tsp" },
            { item: "black pepper", quantity: "1/4 tsp" },
            { item: "salt", quantity: "1/2 tsp" },
          ],
          steps: [
            "Rub the chicken thighs with 1 tsp smoked paprika, 1/2 tsp dried oregano, 1/2 tsp salt and 1/4 tsp black pepper.",
            "Roast until cooked through and cook the rice.",
          ],
        }),
      ],
      INVENTORY,
      BROAD,
    );
    expect(out.options).toHaveLength(1);
  });
});

describe("without broad permission", () => {
  it("only the spice actually spoken is grounded", () => {
    const spoken = transcriptStems(PLAIN);
    expect(isGrounded("paprika", spoken)).toBe(true);
    expect(isGrounded("dried oregano", spoken)).toBe(false);
    expect(isGrounded("garam masala", spoken)).toBe(false);
  });

  it("rejects an option that invents cumin", () => {
    const out = validateAgainstTranscript(
      [
        option({
          ingredients: [
            { item: "chicken thighs", quantity: "400 g" },
            { item: "rice", quantity: "1 cup" },
            { item: "ground cumin", quantity: "1 tsp" },
          ],
        }),
      ],
      ["chicken thighs", "rice", "paprika"],
      PLAIN,
    );
    expect(out.options).toHaveLength(0);
  });
});

describe("broad permission with an explicit exclusion", () => {
  const EXCLUDED = "chicken thighs, rice, herbs and spices but no paprika";

  it("excludes the named spice while keeping the rest", () => {
    const spoken = transcriptStems(EXCLUDED);
    expect(isGrounded("paprika", spoken)).toBe(false);
    expect(isGrounded("smoked paprika", spoken)).toBe(false);
    expect(isGrounded("dried oregano", spoken)).toBe(true);
    expect(isGrounded("black pepper", spoken)).toBe(true);
  });

  it("rejects a recipe that uses the excluded spice", () => {
    const out = validateAgainstTranscript(
      [
        option({
          ingredients: [
            { item: "chicken thighs", quantity: "400 g" },
            { item: "rice", quantity: "1 cup" },
            { item: "smoked paprika", quantity: "1 tsp" },
          ],
        }),
      ],
      INVENTORY,
      EXCLUDED,
    );
    expect(out.options).toHaveLength(0);
  });

  it("still allows a different named spice", () => {
    const out = validateAgainstTranscript(
      [
        option({
          ingredients: [
            { item: "chicken thighs", quantity: "400 g" },
            { item: "rice", quantity: "1 cup" },
            { item: "dried oregano", quantity: "1/2 tsp" },
          ],
          steps: [
            "Rub the chicken thighs with 1/2 tsp dried oregano and roast.",
            "Cook the rice.",
          ],
        }),
      ],
      INVENTORY,
      EXCLUDED,
    );
    expect(out.options).toHaveLength(1);
  });

  it("treats named dry seasonings as seasoning items", () => {
    expect(isSeasoningItem("smoked paprika")).toBe(true);
    expect(isSeasoningItem("chicken thighs")).toBe(false);
  });
});
