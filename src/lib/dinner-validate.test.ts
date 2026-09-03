import { describe, expect, it } from "vitest";

import { groundInventory, isGrounded, transcriptStems } from "./dinner-grounding";
import { validateAgainstTranscript } from "./dinner-validate";
import type { DinnerOption } from "./dinner-types";

const TRANSCRIPT =
  "chicken thighs, carrots, frozen peas, Greek yoghurt, garlic, Dijon mustard and rice";

function option(name: string, items: string[], steps: string[]): DinnerOption {
  return {
    id: name,
    name,
    description: "test",
    minutes: 25,
    servings: 2,
    ingredients: items.map((item) => ({ item, quantity: "1 cup" })),
    steps,
  };
}

describe("grounding against the raw transcript", () => {
  it("strips a hallucinated inventory item (celery)", () => {
    const claimed = [
      "chicken thighs",
      "carrots",
      "frozen peas",
      "Greek yoghurt",
      "garlic",
      "Dijon mustard",
      "rice",
      "celery",
    ];
    const grounded = groundInventory(claimed, TRANSCRIPT);
    expect(grounded).not.toContain("celery");
    expect(grounded).toContain("chicken thighs");
    expect(grounded).toHaveLength(7);
  });

  it("accepts normalised legitimate items", () => {
    const spoken = transcriptStems(TRANSCRIPT);
    for (const item of [
      "chicken",
      "chicken thighs",
      "peas",
      "frozen peas",
      "yoghurt",
      "yogurt",
      "Greek yoghurt",
      "mustard",
      "Dijon mustard",
      "carrot",
      "rice",
      "garlic",
    ]) {
      expect(isGrounded(item, spoken), item).toBe(true);
    }
  });

  it("rejects anything unspoken, including basics", () => {
    const spoken = transcriptStems(TRANSCRIPT);
    for (const item of [
      "water",
      "oil",
      "olive oil",
      "salt",
      "pepper",
      "celery",
      "celery stalks",
      "butter",
      "onion",
      "stock",
    ]) {
      expect(isGrounded(item, spoken), item).toBe(false);
    }
  });
});

describe("validateAgainstTranscript", () => {
  const claimed = [
    "chicken thighs",
    "carrots",
    "frozen peas",
    "Greek yoghurt",
    "garlic",
    "Dijon mustard",
    "rice",
    "celery",
  ];

  it("discards an option that uses celery", () => {
    const result = validateAgainstTranscript(
      [
        option(
          "celery braise",
          ["chicken thighs", "celery", "rice"],
          ["Brown the chicken thighs.", "Add the celery and rice."],
        ),
      ],
      claimed,
      TRANSCRIPT,
    );
    expect(result.inventory).not.toContain("celery");
    expect(result.rejectedInventory).toContain("celery");
    expect(result.options).toHaveLength(0);
  });

  it("keeps a fully grounded option", () => {
    const result = validateAgainstTranscript(
      [
        option(
          "yoghurt mustard chicken with rice",
          ["chicken thighs", "Greek yoghurt", "Dijon mustard", "garlic", "rice", "frozen peas"],
          [
            "Mix the Greek yoghurt, Dijon mustard and garlic, then coat the chicken thighs.",
            "Cook the rice, add the peas at the end.",
          ],
        ),
      ],
      claimed,
      TRANSCRIPT,
    );
    expect(result.options).toHaveLength(1);
  });

  it("discards an option whose steps smuggle in salt, oil or water", () => {
    for (const step of [
      "Season generously with salt and pepper.",
      "Heat a splash of oil in the pan.",
      "Cover with water and simmer.",
      "Fry the onion until soft.",
    ]) {
      const result = validateAgainstTranscript(
        [option("smuggler", ["chicken thighs", "rice"], ["Cook the chicken thighs.", step])],
        claimed,
        TRANSCRIPT,
      );
      expect(result.options, step).toHaveLength(0);
    }
  });
});
