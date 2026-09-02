// Strict validation layer: nothing reaches the screen unless every ingredient it
// mentions was explicitly supplied by the user in this kitchen session.

import type { DinnerOption } from "./dinner-types";

const STOP = new Set([
  "of",
  "the",
  "a",
  "an",
  "and",
  "or",
  "some",
  "fresh",
  "frozen",
  "tinned",
  "canned",
  "raw",
  "plain",
  "whole",
  "half",
  "chopped",
  "sliced",
  "diced",
  "minced",
  "grated",
]);

/** Words that must never sneak in as unstated pantry assumptions. */
const ASSUMED = [
  "water",
  "oil",
  "olive oil",
  "salt",
  "pepper",
  "butter",
  "stock",
  "sugar",
  "flour",
  "vinegar",
  "herbs",
  "spices",
  "seasoning",
];

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .map((w) => (w.endsWith("es") && w.length > 4 ? w.slice(0, -2) : w.replace(/s$/, "")))
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function inInventory(text: string, inventoryTokens: Set<string>): boolean {
  const words = tokens(text);
  if (words.length === 0) return false;
  return words.some((w) => inventoryTokens.has(w));
}

/**
 * Keeps only options whose ingredients all come from the inventory and whose
 * steps introduce no assumed pantry staple the user never mentioned.
 */
export function validateOptions(options: DinnerOption[], inventory: string[]): DinnerOption[] {
  const inventoryTokens = new Set(inventory.flatMap(tokens));

  return options.filter((option) => {
    if (option.ingredients.length === 0 || option.steps.length === 0) return false;

    // Every listed ingredient must be traceable to something the user said.
    if (!option.ingredients.every((ing) => inInventory(ing.item, inventoryTokens))) return false;

    // Steps must not smuggle in staples that were never mentioned.
    const prose = option.steps.join(" ").toLowerCase();
    const smuggled = ASSUMED.some((word) => {
      if (!new RegExp(`\\b${word}\\b`).test(prose)) return false;
      return !inInventory(word, inventoryTokens);
    });
    return !smuggled;
  });
}
