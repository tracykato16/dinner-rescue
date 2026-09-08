import { describe, expect, it } from "vitest";

import { isGrounded, negatedStems, transcriptStems } from "./dinner-grounding";
import { validateAgainstTranscript } from "./dinner-validate";
import type { DinnerOption } from "./dinner-types";

const option = (over: Partial<DinnerOption>): DinnerOption => ({
  id: "opt-1",
  name: "Test dinner",
  description: "Test",
  minutes: 20,
  servings: 2,
  ingredients: [{ item: "chicken", quantity: "400 g" }],
  steps: ["Cook the chicken through."],
  ...over,
});

describe("Australian pepper vs capsicum", () => {
  it("plain pepper never grounds capsicum", () => {
    const spoken = transcriptStems("chicken, rice and salt and pepper");
    expect(isGrounded("pepper", spoken)).toBe(true);
    expect(isGrounded("capsicum", spoken)).toBe(false);
    expect(isGrounded("red capsicum", spoken)).toBe(false);
  });

  it("capsicum never grounds the seasoning pepper", () => {
    const spoken = transcriptStems("chicken, rice and a red capsicum");
    expect(isGrounded("capsicum", spoken)).toBe(true);
    expect(isGrounded("pepper", spoken)).toBe(false);
  });

  it("explicit bell pepper grounds capsicum but not the seasoning", () => {
    const spoken = transcriptStems("chicken, rice and a bell pepper");
    expect(isGrounded("capsicum", spoken)).toBe(true);
    expect(isGrounded("pepper", spoken)).toBe(false);
  });

  it("bell pepper alongside salt and pepper grounds both", () => {
    const spoken = transcriptStems("a bell pepper, chicken, salt and pepper");
    expect(isGrounded("capsicum", spoken)).toBe(true);
    expect(isGrounded("pepper", spoken)).toBe(true);
  });

  it("discards a recipe that adds capsicum when only pepper was said", () => {
    const transcript = "chicken thighs, rice, salt and pepper";
    const out = validateAgainstTranscript(
      [
        option({
          ingredients: [
            { item: "chicken thighs", quantity: "400 g" },
            { item: "capsicum", quantity: "1" },
          ],
        }),
      ],
      ["chicken thighs", "rice", "salt", "pepper", "capsicum"],
      transcript,
    );
    expect(out.inventory).not.toContain("capsicum");
    expect(out.options).toHaveLength(0);
  });
});

describe("photo evidence combined with speech", () => {
  // Photo-detected foods are appended to the transcript as plain text, so the
  // same grounding rules apply to both sources.
  const combined =
    "also chicken thighs in the freezer and herbs and spices. carrots, rice, greek yoghurt";

  it("grounds foods from photos and from talking together", () => {
    const spoken = transcriptStems(combined);
    for (const item of ["chicken thighs", "carrots", "rice", "greek yoghurt", "salt", "pepper"]) {
      expect(isGrounded(item, spoken)).toBe(true);
    }
  });

  it("still refuses food in neither the photos nor the talking", () => {
    const spoken = transcriptStems(combined);
    for (const item of ["celery", "oil", "butter", "stock", "onion", "capsicum"]) {
      expect(isGrounded(item, spoken)).toBe(false);
    }
    expect(isGrounded("water", spoken)).toBe(true);
  });

  it("honours a negation spoken after the photos", () => {
    const spoken = transcriptStems("carrots, milk, onion. actually no onion, I'm out of milk");
    expect(isGrounded("carrots", spoken)).toBe(true);
    expect(isGrounded("onion", spoken)).toBe(false);
    expect(isGrounded("milk", spoken)).toBe(false);
    expect(negatedStems("no onion").has("onion")).toBe(true);
  });
});

describe("messy natural speech", () => {
  it("reads a rambling list without inventing anything", () => {
    const spoken = transcriptStems(
      "um right so I've got, ah, half a bag of frozen peas, a couple of chicken thighs, two eggs, some rice, and all the herbs and spices you can think of, but no garlic",
    );
    for (const item of ["frozen peas", "chicken thighs", "eggs", "rice", "salt", "cumin"]) {
      expect(isGrounded(item, spoken)).toBe(true);
    }
    expect(isGrounded("garlic", spoken)).toBe(false);
    expect(isGrounded("oil", spoken)).toBe(false);
    expect(isGrounded("celery", spoken)).toBe(false);
  });
});
