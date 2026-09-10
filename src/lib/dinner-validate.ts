// Strict validation layer: nothing reaches the screen unless every ingredient it
// mentions is grounded in the ORIGINAL raw transcript for this kitchen session.
//
// The AI's own extracted inventory is NOT trusted as evidence — it is grounded
// against the transcript first (see dinner-grounding.ts), and recipes are then
// validated against that grounded list only.

import type { DinnerOption } from "./dinner-types";
import {
  groundInventory,
  hasVagueSeasoningProse,
  isGrounded,
  isSeasoningItem,
  isVagueQuantity,
  isVagueSeasoningName,
  transcriptStems,
} from "./dinner-grounding";


/**
 * Common food words that models habitually slip into instructions ("season with
 * salt", "add a splash of water", "fry the onion"). This is a detector for
 * step prose only — never an allow-list — and each hit must still be grounded in
 * the transcript or the whole option is discarded.
 */
const STEP_FOOD_WORDS = [
  "water",
  "oil",
  "salt",
  "pepper",
  "butter",
  "stock",
  "broth",
  "sugar",
  "flour",
  "vinegar",
  "milk",
  "cream",
  "cheese",
  "egg",
  "eggs",
  "onion",
  "onions",
  "garlic",
  "celery",
  "carrot",
  "carrots",
  "lemon",
  "lime",
  "herbs",
  "spices",
  "seasoning",
  "wine",
  "honey",
  "soy",
  "yoghurt",
  "yogurt",
  "mustard",
  "rice",
  "pasta",
  "bread",
  "potato",
  "potatoes",
  "tomato",
  "tomatoes",
];

export type ValidationOutcome = {
  /** AI-claimed inventory reduced to what the transcript actually supports. */
  inventory: string[];
  /** Options whose every ingredient and step food is grounded. */
  options: DinnerOption[];
  /** Inventory items thrown away as ungrounded (useful for logging). */
  rejectedInventory: string[];
};

/**
 * Grounds the AI inventory against the raw transcript, then keeps only the
 * options that are fully cookable from that grounded inventory.
 */
export function validateAgainstTranscript(
  options: DinnerOption[],
  claimedInventory: string[],
  transcript: string,
): ValidationOutcome {
  const spoken = transcriptStems(transcript);
  const inventory = groundInventory(claimedInventory, transcript);
  const rejectedInventory = claimedInventory
    .map((i) => i.trim())
    .filter((i) => i.length > 0 && !inventory.includes(i));

  // An ingredient must be grounded in the transcript AND be something the
  // grounded inventory actually contains.
  const inventoryStems = new Set(
    inventory.flatMap((item) =>
      item
        .toLowerCase()
        .replace(/[^a-z\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2),
    ),
  );

  const keep = options.filter((option) => {
    if (option.ingredients.length === 0 || option.steps.length === 0) return false;

    for (const ing of option.ingredients) {
      // Vague seasoning names ("herbs", "mixed spices", "seasoning") are never
      // usable: the user must be told WHICH herb or spice and how much.
      if (isVagueSeasoningName(ing.item)) return false;
      if (isVagueQuantity(ing.quantity)) return false;
      if (!isGrounded(ing.item, spoken)) return false;
      // Belt and braces: also require overlap with the grounded inventory,
      // except for specifically named dry seasonings unlocked by a broad
      // "herbs and spices" permission.
      const overlaps = ing.item
        .toLowerCase()
        .replace(/[^a-z\s]/g, " ")
        .split(/\s+/)
        .some((w) => w.length > 2 && inventoryStems.has(w));
      if (!overlaps && !isSeasoningItem(ing.item)) return false;
    }

    // Steps must not introduce food the user never mentioned.
    const prose = option.steps.join(" ").toLowerCase();
    const smuggled = STEP_FOOD_WORDS.some(
      (word) => new RegExp(`\\b${word}\\b`).test(prose) && !isGrounded(word, spoken),
    );
    if (smuggled) return false;

    // Nor may the prose fall back on vague seasoning wording.
    return !hasVagueSeasoningProse(`${prose} ${option.description}`.toLowerCase());
  });


  return { inventory, options: keep, rejectedInventory };
}
