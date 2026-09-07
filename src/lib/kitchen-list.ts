// The persistent "what I still have" kitchen list.
//
// This is deliberately NOT a pantry system: no quantities, no dates, no stock
// maths. It is a plain list of foods the user has told us they have, updated
// conversationally. All grounding safety from dinner-grounding.ts applies —
// explicit removals and negations always win over word presence.

import { clauses, isGrounded, negatedStems, transcriptStems } from "./dinner-grounding";

/** Chatter that never names a food, on top of the grounding noise list. */
const CHATTER = new Set([
  "add",
  "adds",
  "added",
  "also",
  "still",
  "have",
  "has",
  "had",
  "got",
  "get",
  "gets",
  "put",
  "there",
  "them",
  "these",
  "those",
  "that",
  "this",
  "its",
  "left",
  "leftovers",
  "tonight",
  "today",
  "fridge",
  "freezer",
  "pantry",
  "cupboard",
  "kitchen",
  "please",
  "think",
  "know",
  "reckon",
  "anymore",
  "any",
  "more",
  "now",
  "too",
  "yeah",
  "yep",
  "ive",
  "youve",
  "weve",
  "and",
]);

/** Cues meaning "this is gone" — beyond plain negation ("no", "out of"). */
const REMOVAL_CUE = [
  "used",
  "use",
  "using",
  "finished",
  "finish",
  "gone",
  "rid",
  "chucked",
  "chuck",
  "threw",
  "throw",
  "tossed",
  "binned",
  "eaten",
  "ate",
  "empty",
];

/** Foods we never store as visible list items. */
const NEVER_STORE = new Set(["water"]);

/** The user's own wording for the broad dry-seasoning permission. */
export const SEASONING_ITEM = "herbs and spices";
const SEASONING_WORDS = new Set(["herb", "herbs", "spice", "spices", "seasoning", "seasonings"]);

function tokens(clause: string): string[] {
  return clause.split(/\s+/).filter(Boolean);
}

/** Determiners and quantity words that must never form part of a stored label. */
const DETERMINERS = new Set([
  "the",
  "some",
  "all",
  "half",
  "whole",
  "much",
  "many",
  "little",
  "bit",
  "lot",
  "few",
  "couple",
  "rest",
  "last",
  "our",
  "just",
  "only",
  "about",
  "one",
  "two",
  "three",
  "four",
  "five",
]);

function contentWords(clause: string): string[] {
  return tokens(clause).filter(
    (w) =>
      w.length >= 3 && !CHATTER.has(w) && !DETERMINERS.has(w) && !REMOVAL_CUE.includes(w),
  );
}

function key(item: string): string {
  return item.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

function isRemovalClause(clause: string): boolean {
  return tokens(clause).some((w) => REMOVAL_CUE.includes(w));
}

/**
 * Applies a spoken update to an existing kitchen list.
 *
 * Additions come from ordinary positive food talk; removals come from negation
 * ("no onion anymore", "out of milk") and from removal cues ("used all the
 * chicken", "get rid of the yoghurt"). Nothing is removed unless it is named in
 * a removal/negation clause, and a removed food is never re-added just because
 * its word appears in the transcript.
 */
export function applySpokenUpdate(items: string[], transcript: string): string[] {
  const spoken = transcriptStems(transcript);
  const negated = negatedStems(transcript);
  const out: string[] = [];
  const seen = new Set<string>();
  const removeKeys = new Set<string>();
  const removeWords = new Set<string>();

  const addItem = (item: string) => {
    const k = key(item);
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(item);
  };

  for (const item of items) addItem(item);

  for (const clause of clauses(transcript)) {
    const wordsIn = contentWords(clause);
    if (wordsIn.length === 0) continue;
    const removal = isRemovalClause(clause);

    if (removal) {
      removeKeys.add(key(wordsIn.join(" ")));
      for (const w of wordsIn) removeWords.add(w);
      continue;
    }

    // A positive clause only counts when the transcript itself grounds it, and
    // negation has already stripped negated foods from `spoken`.
    const phrase = wordsIn.join(" ");
    if (!isGrounded(phrase, spoken)) continue;
    if (wordsIn.every((w) => SEASONING_WORDS.has(w))) {
      addItem(SEASONING_ITEM);
      continue;
    }
    if (wordsIn.some((w) => NEVER_STORE.has(w))) continue;
    addItem(phrase);
  }

  // Negation anywhere in the transcript ("no onion anymore") removes as well.
  return out.filter((item) => {
    const k = key(item);
    if (removeKeys.has(k)) return false;
    const ws = k.split(" ");
    if (ws.some((w) => removeWords.has(w))) return false;
    if (item === SEASONING_ITEM) return !negated.has("herb") && !negated.has("spice");
    return !ws.some((w) => negated.has(stemLite(w)));
  });
}

/** Local, tiny stem mirror so removal matching lines up with grounding stems. */
function stemLite(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && (word.endsWith("ches") || word.endsWith("shes") || word.endsWith("ses")))
    return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("es") && !word.endsWith("ees")) return word.slice(0, -1);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/** Builds a fresh kitchen list from a first transcript. */
export function itemsFromTranscript(transcript: string): string[] {
  return applySpokenUpdate([], transcript);
}

/**
 * Keeps only grounded foods from an AI-extracted inventory, dropping water and
 * collapsing seasoning permission into the user's own wording.
 */
export function itemsFromInventory(inventory: string[], transcript: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of inventory) {
    const item = raw.trim();
    if (!item) continue;
    const ws = key(item).split(" ");
    if (ws.some((w) => NEVER_STORE.has(w))) continue;
    const label = ws.every((w) => SEASONING_WORDS.has(w)) ? SEASONING_ITEM : item;
    const k = key(label);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(label);
  }
  return out;
}

/** Removes only the items the user explicitly ticked as used up after cooking. */
export function removeUsedUp(items: string[], usedUp: string[]): string[] {
  const gone = new Set(usedUp.map(key));
  return items.filter((item) => {
    const k = key(item);
    if (gone.has(k)) return false;
    // "chicken thighs" ticked as used up also clears a stored "chicken thighs"
    // written slightly differently, but never a different food.
    return ![...gone].some((g) => g === k || (g.length > 3 && k.length > 3 && (g.includes(k) || k.includes(g))));
  });
}

/** The transcript we hand to the recipe AI for a remembered kitchen. */
export function transcriptFromItems(items: string[]): string {
  return items.join(", ");
}
