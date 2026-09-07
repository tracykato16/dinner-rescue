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

  it("allows water but discards an option whose steps smuggle in salt or oil", () => {
    for (const step of [
      "Season generously with salt and pepper.",
      "Heat a splash of oil in the pan.",
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

describe("water and the herbs/spices category", () => {
  it("always grounds water, so a water step keeps the option", () => {
    const spoken = transcriptStems(TRANSCRIPT);
    expect(isGrounded("water", spoken)).toBe(true);
    const result = validateAgainstTranscript(
      [
        option(
          "poached chicken and rice",
          ["chicken thighs", "rice", "carrots"],
          ["Bring a pan of water to the boil.", "Simmer the chicken thighs, then cook the rice."],
        ),
      ],
      ["chicken thighs", "rice", "carrots"],
      TRANSCRIPT,
    );
    expect(result.options).toHaveLength(1);
  });

  it("unlocks salt, pepper and dry spices when herbs and spices are spoken", () => {
    const spoken = transcriptStems(`${TRANSCRIPT}, and I've got herbs and spices`);
    for (const item of ["salt", "pepper", "paprika", "cumin", "seasoning"]) {
      expect(isGrounded(item, spoken), item).toBe(true);
    }
    for (const item of ["celery", "onion", "oil", "olive oil", "butter", "stock"]) {
      expect(isGrounded(item, spoken), item).toBe(false);
    }
  });

  it("olive oil alone unlocks oil but not salt or pepper", () => {
    const spoken = transcriptStems(`${TRANSCRIPT}, plus olive oil`);
    expect(isGrounded("olive oil", spoken)).toBe(true);
    expect(isGrounded("salt", spoken)).toBe(false);
    expect(isGrounded("pepper", spoken)).toBe(false);
  });
});

describe("explicit negation", () => {
  const g = (t: string, item: string) => isGrounded(item, transcriptStems(t));

  it("rejects a food after 'but no ...' while keeping the positives", () => {
    const t = "I've got chicken, rice and carrots but no garlic";
    expect(g(t, "chicken")).toBe(true);
    expect(g(t, "rice")).toBe(true);
    expect(g(t, "carrots")).toBe(true);
    expect(g(t, "garlic")).toBe(false);
  });

  it("handles 'out of' and 'don't have'", () => {
    expect(g("I've got chicken and rice, but I'm out of milk", "milk")).toBe(false);
    const t = "I don't have celery, I've got carrots";
    expect(g(t, "celery")).toBe(false);
    expect(g(t, "carrots")).toBe(true);
  });

  it("does not let a negation leak past a contrast", () => {
    const t = "I've got chicken, no onion, but I do have garlic";
    expect(g(t, "onion")).toBe(false);
    expect(g(t, "garlic")).toBe(true);
    expect(g(t, "chicken")).toBe(true);
    const t2 = "I don't have garlic but I have onion";
    expect(g(t2, "onion")).toBe(true);
    expect(g(t2, "garlic")).toBe(false);
  });

  it("rejects both foods in 'no garlic and no onion'", () => {
    const t = "I've got chicken and rice. No garlic and no onion";
    expect(g(t, "garlic")).toBe(false);
    expect(g(t, "onion")).toBe(false);
    expect(g(t, "chicken")).toBe(true);
  });

  it("does not unlock oil from 'I've got no olive oil'", () => {
    const t = "I've got chicken and rice, I've got no olive oil";
    expect(g(t, "oil")).toBe(false);
    expect(g(t, "olive oil")).toBe(false);
  });

  it("lets 'no salt' override herbs and spices permission", () => {
    const t = "I've got chicken and rice. I have herbs and spices but no salt";
    expect(g(t, "salt")).toBe(false);
    expect(g(t, "paprika")).toBe(true);
    expect(g(t, "pepper")).toBe(true);
  });

  it("keeps water universal even if negated", () => {
    expect(g("I've got chicken and rice, no water", "water")).toBe(true);
  });
});
