// Independent grounding layer.
//
// The AI extracts an "inventory" from the transcript, but that inventory is
// itself AI-generated: if the model hallucinates celery into both the inventory
// and a recipe, comparing one against the other proves nothing. So the RAW
// TRANSCRIPT is the only source of truth here. Every claimed inventory item must
// be demonstrably present in the transcript text (allowing conservative
// normalisation and a small set of explicit aliases). Uncertain = reject.
//
// Nothing is assumed. Water, oil, salt and pepper are ordinary foods: they pass
// only if they were actually spoken.

/** Words that carry no food identity and must never ground an item on their own. */
const NOISE = new Set([
  "a",
  "an",
  "and",
  "the",
  "of",
  "or",
  "some",
  "bit",
  "little",
  "lot",
  "few",
  "couple",
  "half",
  "whole",
  "bag",
  "jar",
  "tin",
  "tins",
  "can",
  "cans",
  "packet",
  "pack",
  "box",
  "bottle",
  "cup",
  "cups",
  "tbsp",
  "tsp",
  "gram",
  "grams",
  "kilo",
  "kilos",
  "got",
  "have",
  "ive",
  "got",
  "um",
  "uh",
  "okay",
  "ok",
  "well",
  "just",
  "maybe",
  "fresh",
  "frozen",
  "tinned",
  "canned",
  "dried",
  "raw",
  "plain",
  "chopped",
  "sliced",
  "diced",
  "minced",
  "grated",
  "cooked",
  "leftover",
  "homemade",
  "usual",
  "normal",
  "generic",
  "cooking",
  "extra",
  "virgin",
  "light",
  "low",
  "fat",
  "free",
  "range",
  "baby",
  "big",
  "small",
  "large",
  "my",
  "our",
  "any",
  "all",
  "more",
  "much",
  "very",
]);

/**
 * Explicit, conservative aliases. Each key is a word that may appear in an
 * AI-claimed item; its values are alternative words that count as evidence of
 * the same food when found in the transcript. Deliberately small — semantic
 * invention is not allowed.
 */
const ALIASES: Record<string, string[]> = {
  yoghurt: ["yogurt", "yoghurt", "greek"],
  yogurt: ["yoghurt", "yogurt", "greek"],
  chilli: ["chili", "chilli", "chile"],
  chili: ["chilli", "chili"],
  // Australian usage: "pepper" is the seasoning, never the vegetable. Only an
  // explicit "bell pepper" is treated as capsicum (handled in transcriptStems).
  capsicum: ["capsicum"],
  aubergine: ["eggplant", "aubergine"],
  eggplant: ["eggplant", "aubergine"],
  courgette: ["zucchini", "courgette"],
  zucchini: ["zucchini", "courgette"],
  coriander: ["coriander", "cilantro"],
  cilantro: ["coriander", "cilantro"],
  prawn: ["prawn", "shrimp"],
  shrimp: ["prawn", "shrimp"],
  mince: ["mince", "minced"],
  scallion: ["scallion", "shallot", "spring"],
  weetbix: ["weetbix", "weet", "bix"],
  parmesan: ["parmesan", "parmigiano"],
  stock: ["stock", "broth", "bouillon"],
  broth: ["stock", "broth"],
  oil: ["oil", "oils"],
  noodle: ["noodle", "noodles"],
  pasta: ["pasta", "macaroni", "spaghetti", "penne", "fettuccine"],
};

/** Very conservative singularisation of an already-lowercased word. */
function stem(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && (word.endsWith("ches") || word.endsWith("shes") || word.endsWith("ses")))
    return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("es") && !word.endsWith("ees")) return word.slice(0, -1);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * The single universal assumption: ordinary tap water. Nobody should have to say
 * they have water, so it is always grounded — nothing else is.
 */
const UNIVERSAL = ["water"];

/**
 * Detects an explicit broad category permission such as "herbs and spices",
 * "the usual spices" or "seasoning". Fresh herbs are NOT covered — this is dry
 * herbs, dry spices and basic seasoning only.
 */
export function hasSeasoningPermission(transcript: string): boolean {
  return /\b(herbs?|spices?|seasonings?|seasoned)\b/i.test(transcript);
}

/**
 * Conservative, culinary set unlocked by an explicit herbs/spices/seasoning
 * category. Deliberately dry-store only: no oil, fat, stock, dairy, fresh
 * aromatics or sauces.
 */
const SEASONING_CATEGORY = [
  "salt",
  "pepper",
  "seasoning",
  "herb",
  "spice",
  "paprika",
  "cumin",
  "coriander",
  "oregano",
  "thyme",
  "rosemary",
  "cinnamon",
  "turmeric",
  "curry",
  "chilli",
  "chili",
  "bay",
  "nutmeg",
  // Named dry seasonings the AI may sensibly CHOOSE under broad permission. The
  // recipe must name one of these specifically — vague "herbs"/"spices" wording
  // is rejected by the validator.
  "basil",
  "parsley",
  "sage",
  "dill",
  "marjoram",
  "tarragon",
  "cayenne",
  "fennel",
  "cardamom",
  "clove",
  "allspice",
  "garam",
  "masala",
  // Descriptors used in specific seasoning names ("smoked paprika", "ground
  // cumin", "black pepper", "chilli flakes", "mustard powder").
  "smoked",
  "ground",
  "black",
  "white",
  "powder",
  "flake",
  "seed",
];

/**
 * Wording that is too vague to appear in a finished recipe. Broad "herbs and
 * spices" permission lets the AI CHOOSE specific dry seasonings; it must never
 * hand the user an unnamed one.
 */
const VAGUE_INGREDIENT =
  /^(?:(?:mixed|dried|italian|assorted|various|your|the|some|a|an|of|and|ground)\s+)*(?:herbs?|spices?|seasonings?|seasoning\s+mix|herbs?\s+and\s+spices?|spice\s+mix|mixed\s+herbs?)\s*$/i;

const VAGUE_QUANTITY = /\b(?:to taste|as needed|as desired|as required|a sprinkle|a scattering)\b/i;

const VAGUE_PROSE = [
  /\bseason(?:ing)?\s+to\s+taste\b/i,
  /\bto\s+taste\b/i,
  /\b(?:sprinkle|pinch|dash|scattering|handful)\s+of\s+(?:mixed\s+|dried\s+|your\s+)?(?:herbs?|spices?|seasoning)\b/i,
  /\bherbs?\s+and\s+spices?\b/i,
  /\bmixed\s+herbs?\b/i,
  /\byour\s+(?:herbs?|spices?|seasoning)\b/i,
  /\b(?:some|any)\s+(?:herbs?|spices?|seasoning)\b/i,
  /\bseasoning\b/i,
];

/** True when an ingredient name is too vague to be a usable seasoning. */
export function isVagueSeasoningName(item: string): boolean {
  return VAGUE_INGREDIENT.test(item.trim());
}

/** True when a quantity string fails to tell the user how much to use. */
export function isVagueQuantity(quantity: string): boolean {
  const q = quantity.trim();
  if (q.length === 0) return true;
  return VAGUE_QUANTITY.test(q);
}

/** True when recipe prose leans on vague seasoning wording. */
export function hasVagueSeasoningProse(prose: string): boolean {
  return VAGUE_PROSE.some((re) => re.test(prose));
}


/**
 * Words that flip a clause into "I do NOT have this". Conservative and explicit.
 */
const NEGATION_CUE = [
  "no",
  "not",
  "none",
  "dont",
  "doesnt",
  "didnt",
  "havent",
  "hasnt",
  "cant",
  "without",
  "out",
  "ran",
  "missing",
  "lacking",
  "finished",
  "empty",
  "zero",
];

/**
 * Splits a transcript into short clauses so a negation cannot leak past a
 * contrast ("I don't have garlic but I have onion"). Splits on punctuation and
 * the ordinary spoken joiners.
 */
export function clauses(transcript: string): string[] {
  return transcript
    .toLowerCase()
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+(?:but|though|however|although|and|plus|also|except|only)\s+|\s{2,}/)
    .flatMap((part) => part.split(/\s+/).join(" ").trim())
    .filter(Boolean);
}

/**
 * Stems the user explicitly said they do NOT have. A clause is negated from its
 * first negation cue onwards, so "no olive oil" negates both words while
 * "I do have garlic" is untouched.
 */
export function negatedStems(transcript: string): Set<string> {
  const out = new Set<string>();
  for (const clause of clauses(transcript)) {
    const ws = clause.split(" ");
    const cueAt = ws.findIndex((w) => NEGATION_CUE.includes(w));
    if (cueAt === -1) continue;
    for (const word of ws.slice(cueAt + 1)) {
      if (word.length < 3 || NOISE.has(word) || NEGATION_CUE.includes(word)) continue;
      out.add(stem(word));
      const aliases = ALIASES[word] ?? ALIASES[stem(word)];
      if (aliases) for (const a of aliases) out.add(stem(a));
    }
  }
  // Tap water is a deliberate product-level assumption and can never be negated.
  for (const w of UNIVERSAL) out.delete(stem(w));
  return out;
}

/** All meaningful stems present in the raw transcript, plus water. */
export function transcriptStems(transcript: string): Set<string> {
  const set = new Set<string>();
  for (const word of words(transcript)) {
    if (word.length < 3 || NOISE.has(word)) continue;
    set.add(stem(word));
  }
  for (const w of UNIVERSAL) set.add(stem(w));

  // Australian terminology safety. "Bell pepper" is the only wording that
  // grounds capsicum; plain "pepper" is the seasoning and must never do so.
  // Conversely, if the ONLY mention of pepper is inside "bell pepper", the
  // seasoning is not grounded either.
  const lower = transcript.toLowerCase();
  const bellPeppers = (lower.match(/\bbell\s+peppers?\b/g) ?? []).length;
  const peppers = (lower.match(/\bpeppers?\b/g) ?? []).length;
  if (bellPeppers > 0) set.add(stem("capsicum"));
  if (peppers > 0 && peppers === bellPeppers) set.delete(stem("pepper"));

  if (hasSeasoningPermission(transcript)) {
    for (const w of SEASONING_CATEGORY) set.add(stem(w));
  }
  // Explicit negation always wins over word presence and over broad category
  // permission ("herbs and spices but no salt").
  for (const s of negatedStems(transcript)) set.delete(s);
  for (const w of UNIVERSAL) set.add(stem(w));
  return set;
}



/** Content stems of a phrase, with noise/qualifier words dropped. */
function phraseStems(phrase: string): string[] {
  return words(phrase)
    .filter((w) => w.length >= 3 && !NOISE.has(w))
    .map(stem);
}

function stemGrounded(candidate: string, spoken: Set<string>): boolean {
  if (spoken.has(candidate)) return true;
  const aliases = ALIASES[candidate];
  if (aliases) {
    for (const alias of aliases) if (spoken.has(stem(alias))) return true;
  }
  return false;
}

/**
 * A phrase is grounded when EVERY one of its content words is grounded in the
 * transcript. "chicken thighs" passes on a transcript saying "chicken thighs";
 * "chicken" alone also passes ("thighs" simply isn't claimed). "celery" fails
 * unless celery was spoken. Multi-word inventions such as "celery stalks" fail
 * on the "celery" word, so partial matches can never smuggle food in.
 */
export function isGrounded(phrase: string, spoken: Set<string>): boolean {
  const stems = phraseStems(phrase);
  if (stems.length === 0) return false;
  return stems.every((s) => stemGrounded(s, spoken));
}

/**
 * Drops every AI-claimed inventory item that isn't grounded in the raw
 * transcript. This grounded list — not the AI's own claim — is what recipes are
 * validated against.
 */
export function groundInventory(inventory: string[], transcript: string): string[] {
  const spoken = transcriptStems(transcript);
  return inventory.map((i) => i.trim()).filter((i) => i.length > 0 && isGrounded(i, spoken));
}
