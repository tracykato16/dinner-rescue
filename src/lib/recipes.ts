// Deterministic recipe engine for the Dinner Rescue prototype.
// Strict rule: a recipe is only eligible when EVERY ingredient it needs is
// something the user told us they have. The only assumed basics are water,
// salt, pepper and a generic cooking oil.

export type Effort = "lazy" | "normal" | "keen";

export type RecipeTemplate = {
  id: string;
  name: string;
  effort: Effort;
  baseMinutes: number;
  /** Every one of these must be on hand or the recipe is not offered. */
  core: string[];
  /** Extras we'll happily fold in — only ever mentioned when the user has them. */
  bonus: string[];
  blurb: string;
  /** Steps may only mention core ingredients plus universal basics. */
  steps: string[];
};

export type Suggestion = {
  recipe: RecipeTemplate;
  score: number;
  /** Canonical ingredients this dinner will actually use. */
  used: string[];
  /** Extras from the user's own list folded in. */
  extras: string[];
  minutes: number;
  servings: number;
};

export type RescueInput = {
  ingredients: string[];
  people: string;
  effort: Effort;
  avoid: string;
  useUp: string;
};

/** The only things we assume are in every kitchen. */
export const UNIVERSAL_BASICS = ["water", "salt", "pepper", "cooking oil"];

const ALIASES: Record<string, string> = {
  chook: "chicken",
  "chicken thighs": "chicken",
  "chicken breast": "chicken",
  "chicken thigh": "chicken",
  "chicken breasts": "chicken",
  mince: "beef mince",
  "beef mince": "beef mince",
  "lamb mince": "beef mince",
  capsicums: "capsicum",
  tomatoes: "tomato",
  "tinned tomatoes": "tomato",
  "canned tomatoes": "tomato",
  onions: "onion",
  "spring onion": "onion",
  eggplants: "eggplant",
  zucchinis: "zucchini",
  carrots: "carrot",
  potatoes: "potato",
  spuds: "potato",
  "sweet potatoes": "sweet potato",
  kumara: "sweet potato",
  mushrooms: "mushroom",
  "baby spinach": "spinach",
  silverbeet: "spinach",
  noodles: "noodle",
  "rice noodles": "noodle",
  eggs: "egg",
  prawns: "prawn",
  "tinned tuna": "tuna",
  "canned tuna": "tuna",
  chickpeas: "chickpea",
  "tinned chickpeas": "chickpea",
  "cream cheese": "cream cheese",
  "sour cream": "cream",
  yoghurt: "yoghurt",
  yogurt: "yoghurt",
  cheddar: "cheese",
  "tasty cheese": "cheese",
  parmesan: "cheese",
  haloumi: "halloumi",
  beans: "bean",
  "tinned beans": "bean",
  broc: "broccoli",
  "frozen peas": "pea",
  peas: "pea",
  "puff pastry": "pastry",
  tortillas: "tortilla",
  wraps: "tortilla",
  "flat bread": "tortilla",
  couscous: "couscous",
  macaroni: "pasta",
  "long pasta": "pasta",
  spaghetti: "pasta",
  penne: "pasta",
  "wholegrain lentil": "lentil",
  lentils: "lentil",
  sardine: "sardine",
  sardines: "sardine",
  "tin of sardines": "sardine",
  "tins of sardines": "sardine",
  anchovies: "anchovy",
  anchovie: "anchovy",
  "corn chip": "corn chip",
  "corn chips": "corn chip",
  "natural corn chips": "corn chip",
  "chicken tonight": "simmer sauce",
  "simmer sauce": "simmer sauce",
  "rice paper roll": "rice paper",
  "rice paper rolls": "rice paper",
  "greek yoghurt": "yoghurt",
  "greek yogurt": "yoghurt",
  "philadelphia cream cheese": "cream cheese",
  philadelphia: "cream cheese",
  avocado: "avocado",
  avocados: "avocado",
  "half an avocado": "avocado",
  "tomato sauce": "tomato sauce",
  "vine ripened tomato": "tomato",
  "tomato vine ripened": "tomato",
  jalapeno: "jalapeno",
  jalapenos: "jalapeno",
  oat: "oat",
  oats: "oat",
  "weet-bix": "weet-bix",
  weetbix: "weet-bix",
  "white rice": "rice",
  "plain flour": "flour",
  "self-raising flour": "flour",
  "self raising flour": "flour",
  "cup a soup": "soup mix",
  "creamy bacon pasta": "pasta side",
  steak: "steak",
  steaks: "steak",
  "rump steak": "steak",
  porterhouse: "steak",
  "scotch fillet": "steak",
  "chicken bits": "chicken",
  "chicken pieces": "chicken",
  "frozen pea": "pea",
  "gravy mix": "gravy",
  gravy: "gravy",
  "wholegrain mustard": "mustard",
  "whole grain mustard": "mustard",
  "dijon": "mustard",
  "mustard powder": "mustard",
};

export function normalise(raw: string): string {
  const s = raw.trim().toLowerCase().replace(/\s+/g, " ").replace(/\.$/, "");
  const singular = s.endsWith("s") ? s.slice(0, -1) : s;
  return ALIASES[s] ?? ALIASES[singular] ?? s;
}

/** Words/phrases that are never ingredients — dictation filler and vagueness. */
const NOISE = new Set([
  "um",
  "uh",
  "er",
  "ok",
  "okay",
  "yeah",
  "yep",
  "nah",
  "usual",
  "the usual",
  "stuff",
  "things",
  "thing",
  "etc",
  "whatever",
  "that's it",
  "thats it",
  "done",
  "left",
  "leftovers",
  "bits",
  "few other pantry staples",
  "pantry staples",
  "staples",
  "normally",
  "usually",
  "what's that one",
  "whats that one",
  "sauces",
  "no idea",
  "hang on",
  "hold on",
  "wait",
  "let me look",
  "let me check",
  "checking the freezer",
  "checking the fridge",
  "checking the pantry",
  "oh",
  "well",
  "right",
  "so",
  "and",
  "as well",
]);

/** Phrases that add nothing but appear constantly in spoken lists. */
const FILLER_PHRASES = [
  /\byou can think of\b/g,
  /\bpretty much\b/g,
  /\ball the\b/g,
  /\bor something\b/g,
  /\bas well\b/g,
  /\bi think\b/g,
  /\bi'?m checking\b/g,
  /\bhang on\b/g,
  /\bhold on\b/g,
  /\blet me (look|check|see)\b/g,
  /\bin the (fridge|freezer|pantry|cupboard)\b/g,
  /\bfrom the (fridge|freezer|pantry|cupboard)\b/g,
  /\bor so\b/g,
  /\bleft ?over\b/g,
];

const LEADING_JUNK =
  /^(oh|well|so|right|and|i'?ve|i'?m|i|we'?ve|we|you|have|has|had|got|get|there'?s|there|is|are|also|plus|then|maybe|just|still|only|about|around|roughly|my|our|the|a|an|of|some|any|little|bit|couple|few|half|lots|loads|heaps|plenty|bunch|dozen|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b\s*/;

const CONTAINER_JUNK =
  /^(bag|bags|jar|jars|tin|tins|can|cans|tinned|canned|packet|packets|pack|packs|box|boxes|bottle|bottles|carton|cartons|tub|tubs|punnet|punnets|block|blocks|slice|slices|handful|handfuls|spoon|spoons|tablespoon|teaspoon|cup|cups|kg|kgs|g|grams|gram|ml|litre|litres|l)\b\s*(of\b\s*)?/;

function cleanItem(part: string): string | null {
  let s = part
    .toLowerCase()
    .replace(/[^a-z0-9'\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const rx of FILLER_PHRASES) s = s.replace(rx, " ");
  s = s.replace(/\s+/g, " ").trim();

  // Strip leading quantities, containers and conversational lead-ins, repeatedly.
  for (let i = 0; i < 6; i++) {
    const before = s;
    s = s.replace(LEADING_JUNK, "").replace(CONTAINER_JUNK, "").trim();
    if (s === before) break;
  }

  s = s.replace(/\s+(left|remaining|only)$/, "").replace(/\s+of$/, "").trim();

  if (s.length < 2 || s.length > 40) return null;
  if (NOISE.has(s)) return null;
  if (!/[aeiou]/.test(s)) return null;

  return normalise(s);
}

export function parseIngredients(text: string): string[] {
  const cleaned = text
    .replace(/\b(um+|uh+|erm+|hmm+)\b/gi, " ")
    .replace(/\b(i'?ve got|i have got|i have|we'?ve got|i got)\b/gi, ",")
    .replace(/\b(hang on|hold on|let me (look|check|see))\b/gi, ",");

  const parts = cleaned.split(
    /[,;.\n\u2022\/]|\band\b|\bplus\b|\balso\b|\bas well as\b|\bthen\b|\boh\b|\+|…|\.{2,}/gi,
  );

  const out: string[] = [];
  for (const part of parts) {
    const item = cleanItem(part);
    if (item && !out.includes(item)) out.push(item);
    if (out.length >= 80) break;
  }
  return out;
}

/** True when the user's list contains something that stands in for `want`. */
function has(have: string[], want: string): boolean {
  return have.some((h) => h === want || h.includes(want) || want.includes(h));
}

const R = (r: RecipeTemplate) => r;

export const RECIPES: RecipeTemplate[] = [
  R({
    id: "fried-rice",
    name: "Clean-out-the-fridge fried rice",
    effort: "lazy",
    baseMinutes: 20,
    core: ["rice", "egg"],
    bonus: ["carrot", "pea", "onion", "chicken", "bacon", "capsicum", "broccoli", "cabbage", "soy sauce"],
    blurb: "The classic rescue meal, built on rice and eggs.",
    steps: [
      "Cook the rice if it isn't already cooked, then spread it out to cool for a few minutes.",
      "Heat a good splash of oil in your biggest frypan over high heat.",
      "Beat the eggs with a pinch of salt, pour them in, scramble quickly, then tip onto a plate.",
      "Add the rice to the hot pan and press it flat so it catches and crisps a little.",
      "Return the egg, toss it through and season well with salt and pepper.",
      "Serve straight from the pan while it's steaming.",
    ],
  }),
  R({
    id: "chicken-spinach-pan",
    name: "Chicken and spinach pan-fry",
    effort: "normal",
    baseMinutes: 25,
    core: ["chicken", "spinach"],
    bonus: ["cream cheese", "cream", "garlic", "mushroom", "rice", "pasta", "onion", "cheese"],
    blurb: "One pan, ten minutes of work, proper dinner.",
    steps: [
      "Cut the chicken into bite-sized pieces and season well with salt and pepper.",
      "Brown the chicken in a hot oiled pan for 5–6 minutes. Don't crowd it.",
      "Add a splash of water to the pan and scrape up the sticky brown bits.",
      "Add the spinach in handfuls, stirring until it wilts right down.",
      "Simmer 3–4 minutes until the chicken is cooked right through (75°C in the thickest piece).",
      "Taste, season again, and serve.",
    ],
  }),
  R({
    id: "tray-bake",
    name: "Chuck-it-in tray bake",
    effort: "lazy",
    baseMinutes: 40,
    core: ["potato", "carrot"],
    bonus: ["chicken", "sausage", "pumpkin", "onion", "capsicum", "sweet potato", "chickpea", "broccoli"],
    blurb: "Ten minutes of chopping, then the oven does the rest.",
    steps: [
      "Heat the oven to 200°C (180°C fan).",
      "Chop the potato and carrot into roughly even chunks so they cook at the same rate.",
      "Toss on a lined tray with plenty of oil, salt and pepper.",
      "Roast 30–35 minutes, giving the tray a shake halfway.",
      "If you've added meat, check it's cooked right through (75°C in the thickest part).",
      "Serve straight off the tray.",
    ],
  }),
  R({
    id: "pasta-bake",
    name: "Anything-goes pasta bake",
    effort: "normal",
    baseMinutes: 35,
    core: ["pasta", "cheese", "tomato"],
    bonus: ["beef mince", "spinach", "onion", "bacon", "zucchini", "mushroom", "chicken"],
    blurb: "Feeds a crowd and reheats brilliantly.",
    steps: [
      "Heat the oven to 200°C and boil the pasta in well-salted water, two minutes short of packet time.",
      "Chop the tomato and simmer it in an oiled oven-proof pan for 6–8 minutes until saucy.",
      "Drain the pasta, keeping a cup of the water, and stir it through the sauce with a splash of that water.",
      "Season firmly with salt and pepper.",
      "Scatter the cheese over the top.",
      "Bake 15 minutes until bubbling and golden. Rest 5 minutes before serving.",
    ],
  }),
  R({
    id: "omelette",
    name: "Big pan omelette",
    effort: "lazy",
    baseMinutes: 12,
    core: ["egg"],
    bonus: ["cheese", "spinach", "mushroom", "tomato", "onion", "bacon", "potato", "capsicum", "avocado"],
    blurb: "Dinner in twelve minutes when you truly cannot be bothered.",
    steps: [
      "Beat the eggs with a good pinch of salt and pepper until completely smooth.",
      "Heat a little oil in a non-stick pan over medium heat.",
      "Pour the eggs in and turn the heat down low.",
      "Drag the set edges into the middle a few times, then leave it alone to set.",
      "Fold it over on itself once the top is just barely wet.",
      "Slide onto a plate and eat immediately.",
    ],
  }),
  R({
    id: "mince-stirfry",
    name: "Speedy mince bowls",
    effort: "normal",
    baseMinutes: 20,
    core: ["beef mince", "rice"],
    bonus: ["carrot", "onion", "garlic", "capsicum", "cabbage", "pea", "soy sauce"],
    blurb: "Big flavour from mince, over rice.",
    steps: [
      "Start the rice so it's ready when the pan is.",
      "Get a pan very hot with a little oil.",
      "Brown the mince hard without stirring too much — you want colour, not steam.",
      "Add a splash of water and scrape the pan so the juices coat the mince.",
      "Simmer 2 minutes until the mince is cooked right through, then season well with salt and pepper.",
      "Spoon it over the rice.",
    ],
  }),
  R({
    id: "veg-soup",
    name: "Bottom-of-the-fridge veg soup",
    effort: "lazy",
    baseMinutes: 30,
    core: ["carrot", "onion", "potato"],
    bonus: ["pumpkin", "celery", "tomato", "bean", "chickpea", "sweet potato", "lentil"],
    blurb: "The most forgiving way to use up tired vegetables.",
    steps: [
      "Roughly chop the veg — it's getting blended, so don't fuss.",
      "Soften the onion in oil in a large pot for 5 minutes.",
      "Add the carrot and potato and stir for 2 minutes.",
      "Pour in enough water to just cover, then simmer 20 minutes until everything is soft.",
      "Blend smooth, or mash for a chunky soup.",
      "Season generously — soup needs more salt and pepper than you'd think.",
    ],
  }),
  R({
    id: "quesadillas",
    name: "Crispy loaded quesadillas",
    effort: "lazy",
    baseMinutes: 15,
    core: ["tortilla", "cheese"],
    bonus: ["bean", "chicken", "capsicum", "onion", "corn", "tomato", "spinach", "beef mince", "jalapeno"],
    blurb: "Toasty, cheesy and ready before the kettle boils.",
    steps: [
      "Scatter cheese over half a tortilla, then fold it over and press down.",
      "Heat a lightly oiled pan over medium heat.",
      "Cook 2–3 minutes a side until golden and crisp and the cheese has melted.",
      "Repeat with the rest of the tortillas.",
      "Rest for a minute so the cheese sets slightly.",
      "Cut into wedges, season with a little salt and pepper, and serve.",
    ],
  }),
  R({
    id: "curry",
    name: "House curry",
    effort: "keen",
    baseMinutes: 40,
    core: ["onion", "tomato", "curry powder", "rice"],
    bonus: ["chicken", "chickpea", "potato", "cream", "yoghurt", "spinach", "pumpkin", "lentil"],
    blurb: "Worth the extra ten minutes. Better the next day, too.",
    steps: [
      "Slice the onion finely and cook slowly in oil for 8–10 minutes until genuinely golden. This is the whole dish.",
      "Stir in a heaped tablespoon of curry powder for 1 minute until it smells toasty.",
      "Add the chopped tomato and cook down for 5 minutes into a thick paste.",
      "Pour in enough water to make a loose sauce and simmer gently 20 minutes, uncovered.",
      "Start the rice while the curry simmers.",
      "Season with salt and pepper and spoon over the rice.",
    ],
  }),
  R({
    id: "frittata",
    name: "Veg and potato frittata",
    effort: "normal",
    baseMinutes: 30,
    core: ["egg", "potato"],
    bonus: ["cheese", "spinach", "onion", "zucchini", "bacon", "capsicum", "pea"],
    blurb: "Great hot, great cold in tomorrow's lunchbox.",
    steps: [
      "Heat the oven to 190°C.",
      "Slice the potato thinly and fry in an oiled oven-proof pan for 8–10 minutes until nearly tender.",
      "Beat the eggs with salt and pepper and pour them over the potato.",
      "Cook on the stove 3 minutes until the edges set.",
      "Bake 12–15 minutes until just set in the middle.",
      "Rest 5 minutes before slicing into wedges.",
    ],
  }),
  R({
    id: "noodle-bowl",
    name: "Ten-minute noodle bowl",
    effort: "lazy",
    baseMinutes: 12,
    core: ["noodle", "egg"],
    bonus: ["chicken", "spinach", "carrot", "mushroom", "broccoli", "cabbage", "soy sauce", "sriracha"],
    blurb: "Hot, savoury, in the bowl faster than delivery.",
    steps: [
      "Bring a pot of well-salted water to the boil with a splash of oil.",
      "Add the noodles and cook to packet time.",
      "Slide the eggs in to poach for the last 3 minutes, or fry them separately.",
      "Ladle the noodles and a little of the cooking water into a big bowl.",
      "Top with the eggs and plenty of pepper.",
      "Eat while it's steaming.",
    ],
  }),
  R({
    id: "tuna-pasta",
    name: "Pantry tuna pasta",
    effort: "lazy",
    baseMinutes: 18,
    core: ["pasta", "tuna"],
    bonus: ["tomato", "onion", "cheese", "spinach", "pea", "lemon", "garlic", "caper"],
    blurb: "Nothing fresh in the house? This still works.",
    steps: [
      "Boil the pasta in well-salted water and keep a mug of the water back.",
      "Warm a good glug of oil in a pan over low heat.",
      "Add the tuna, oil and all, and break it up with a spoon.",
      "Add a ladle of the pasta water and let it come together into a loose sauce.",
      "Toss the drained pasta through for a minute so it grips.",
      "Finish with plenty of pepper and a pinch of salt.",
    ],
  }),
  R({
    id: "chickpea-braise",
    name: "Warm chickpea and tomato braise",
    effort: "normal",
    baseMinutes: 25,
    core: ["chickpea", "tomato"],
    bonus: ["spinach", "onion", "garlic", "cheese", "egg", "capsicum", "yoghurt", "bread"],
    blurb: "Cheap, filling and mostly from the cupboard.",
    steps: [
      "Warm a good splash of oil in a wide pan.",
      "Add the chopped tomato and cook down for 6–8 minutes until jammy.",
      "Tip in the drained chickpeas with a splash of water.",
      "Simmer 12–15 minutes until thick and glossy.",
      "Mash a few chickpeas against the pan to thicken the sauce.",
      "Season hard with salt and pepper and serve in bowls.",
    ],
  }),
  R({
    id: "sausage-braise",
    name: "Sausages with braised veg",
    effort: "normal",
    baseMinutes: 30,
    core: ["sausage", "potato", "carrot"],
    bonus: ["onion", "tomato", "bean", "cabbage", "gravy", "mustard"],
    blurb: "Proper hearty dinner from a pack of snags.",
    steps: [
      "Brown the sausages all over in a wide oiled pan, then set them aside.",
      "Chop the potato and carrot small and cook in the same pan for 6–8 minutes.",
      "Add a mug of water and scrape up the sticky bits.",
      "Return the sausages, cover and simmer 15 minutes.",
      "Check the sausages are cooked right through before serving.",
      "Season with salt and pepper and serve.",
    ],
  }),
  R({
    id: "mac-cheese",
    name: "Stovetop mac and cheese",
    effort: "lazy",
    baseMinutes: 20,
    core: ["pasta", "cheese", "cream cheese"],
    bonus: ["mustard", "milk", "onion", "jalapeno", "bacon"],
    blurb: "Pantry only. Cream cheese makes it silky without a white sauce.",
    steps: [
      "Boil the pasta in well-salted water until just tender, then drain, saving a mug of the water.",
      "Back in the warm pot, stir the cream cheese with a splash of the pasta water until smooth.",
      "Add the grated cheese a handful at a time, stirring until glossy.",
      "Return the pasta and toss, loosening with more pasta water until the sauce pours slowly off the spoon.",
      "Season hard with salt and plenty of pepper.",
      "Serve straight away while it's still loose.",
    ],
  }),
  R({
    id: "sardine-pasta",
    name: "Sardine pasta",
    effort: "lazy",
    baseMinutes: 18,
    core: ["pasta", "sardine"],
    bonus: ["anchovy", "garlic", "cheese", "lemon", "caper", "tomato", "onion", "jalapeno"],
    blurb: "Cheap, savoury and entirely from the cupboard.",
    steps: [
      "Boil the pasta in well-salted water and keep a mug of the water back.",
      "Warm plenty of oil in a pan over low heat.",
      "Add the sardines and break them up so they melt into the oil.",
      "Add a ladle of pasta water and let it come together.",
      "Toss the drained pasta through for a minute so the sauce grips.",
      "Finish with lots of pepper.",
    ],
  }),
  R({
    id: "nachos",
    name: "Loaded corn chip nachos",
    effort: "lazy",
    baseMinutes: 15,
    core: ["corn chip", "cheese"],
    bonus: ["bean", "lentil", "avocado", "jalapeno", "tomato", "yoghurt", "onion", "beef mince"],
    blurb: "Half a bag of chips is a dinner if you treat it like one.",
    steps: [
      "Heat the oven to 200°C and spread the corn chips on a lined tray.",
      "Scatter the cheese over, leaving a few chips bare so they stay crisp.",
      "Bake 8–10 minutes until the cheese has melted.",
      "Crack a little pepper over the top.",
      "Slide it onto a board or leave it on the tray.",
      "Eat while it's hot.",
    ],
  }),
  R({
    id: "simmer-sauce-rice",
    name: "Jar-sauce dinner over rice",
    effort: "lazy",
    baseMinutes: 25,
    core: ["simmer sauce", "rice"],
    bonus: ["chicken", "onion", "carrot", "capsicum", "pea", "lentil", "spinach", "chickpea"],
    blurb: "A jar in the cupboard is a perfectly good weeknight dinner.",
    steps: [
      "Start the rice so it's ready when the pan is.",
      "Heat a little oil in a wide pan.",
      "Pour in the jar of sauce, swill the jar with a splash of water and add that too.",
      "Simmer 12–15 minutes until thickened. If you've added meat, check it's cooked right through (75°C).",
      "Season with salt and pepper to taste.",
      "Spoon it over the rice.",
    ],
  }),
  R({
    id: "savoury-oats",
    name: "Savoury oat and egg bowl",
    effort: "lazy",
    baseMinutes: 12,
    core: ["oat", "egg"],
    bonus: ["cheese", "spinach", "onion", "soy sauce", "avocado", "jalapeno", "sriracha"],
    blurb: "Like a fast risotto. Sounds odd, tastes great.",
    steps: [
      "Bring a mug and a half of well-salted water to a simmer per person.",
      "Stir in the oats and cook 4–5 minutes until thick and creamy.",
      "Fry or poach the eggs in a little oil while the oats sit.",
      "Season the oats properly with salt and pepper.",
      "Spoon the oats into bowls and top with the eggs.",
      "Crack more pepper over and eat straight away.",
    ],
  }),
  R({
    id: "steak-peas",
    name: "Pan steak with crushed peas",
    effort: "normal",
    baseMinutes: 22,
    core: ["steak", "pea"],
    bonus: ["potato", "onion", "mushroom", "gravy", "garlic", "horseradish", "mustard", "rice"],
    blurb: "Cook the steak properly and the sides can be dead simple.",
    steps: [
      "Take the steak out of the fridge, pat it dry and salt both sides generously.",
      "Get a heavy pan smoking hot with a little oil. Lay the steak in and don't touch it for 2–3 minutes.",
      "Flip once and cook another 2–3 minutes for medium.",
      "Rest the steak on a warm plate for at least 5 minutes — this is not optional.",
      "Meanwhile, simmer the peas in salted water for 3 minutes, drain, then crush lightly with a splash of oil, salt and pepper.",
      "Slice the steak across the grain and serve on the peas.",
    ],
  }),
  R({
    id: "chicken-pea-skillet",
    name: "Chicken and pea skillet",
    effort: "lazy",
    baseMinutes: 20,
    core: ["chicken", "pea"],
    bonus: ["cream cheese", "onion", "rice", "pasta", "garlic", "cheese", "curry powder", "mustard"],
    blurb: "Odds and ends of chicken plus frozen peas — a full dinner in one pan.",
    steps: [
      "Cut the chicken into small even pieces and season with salt and pepper.",
      "Brown it in a hot oiled pan for 5–6 minutes without crowding the pan.",
      "Add a splash of water and scrape up the sticky bits into a light sauce.",
      "Tip in the peas straight from the bag and simmer 4–5 minutes.",
      "Check the chicken is cooked right through (75°C in the thickest piece).",
      "Taste, season again, and serve.",
    ],
  }),
  R({
    id: "egg-sanga",
    name: "Proper fried egg sanga",
    effort: "lazy",
    baseMinutes: 10,
    core: ["bread", "egg"],
    bonus: ["cheese", "tomato sauce", "avocado", "bacon", "spinach", "tomato", "mustard"],
    blurb: "Ten minutes, two ingredients, no complaints.",
    steps: [
      "Heat a little oil in a pan over medium-high heat.",
      "Fry the eggs to your liking — season them with salt and pepper in the pan.",
      "Toast or warm the bread while the eggs cook.",
      "Pile the eggs onto the bread.",
      "Crack a bit more pepper over the top.",
      "Close it up, cut in half and eat over the sink.",
    ],
  }),
];

const EFFORT_ORDER: Record<Effort, number> = { lazy: 0, normal: 1, keen: 2 };

export function servingsFor(people: string): number {
  return people === "5+" ? 5 : Number(people) || 2;
}

/** Rough per-serve amounts so the cook screen shows a usable recipe. */
type Qty = { per: number; unit: string; each?: boolean; step?: number };

const QUANTITIES: Record<string, Qty> = {
  chicken: { per: 180, unit: "g" },
  steak: { per: 200, unit: "g" },
  "beef mince": { per: 150, unit: "g" },
  sausage: { per: 2, unit: "", each: true },
  bacon: { per: 1, unit: "rasher", each: true },
  tuna: { per: 0.5, unit: "tin" },
  sardine: { per: 0.5, unit: "tin" },
  anchovy: { per: 2, unit: "fillet", each: true },
  prawn: { per: 120, unit: "g" },
  egg: { per: 2, unit: "", each: true },
  rice: { per: 0.5, unit: "cup" },
  pasta: { per: 100, unit: "g" },
  noodle: { per: 100, unit: "g" },
  couscous: { per: 0.4, unit: "cup" },
  oat: { per: 0.5, unit: "cup" },
  bread: { per: 2, unit: "slice", each: true },
  tortilla: { per: 2, unit: "", each: true },
  "corn chip": { per: 80, unit: "g" },
  potato: { per: 1.5, unit: "", each: true },
  "sweet potato": { per: 1, unit: "", each: true },
  carrot: { per: 1, unit: "", each: true },
  onion: { per: 0.5, unit: "", each: true },
  tomato: { per: 1.5, unit: "", each: true },
  capsicum: { per: 0.5, unit: "", each: true },
  zucchini: { per: 0.5, unit: "", each: true },
  mushroom: { per: 60, unit: "g" },
  broccoli: { per: 0.5, unit: "head" },
  cabbage: { per: 100, unit: "g" },
  pumpkin: { per: 200, unit: "g" },
  celery: { per: 1, unit: "stick", each: true },
  spinach: { per: 2, unit: "handful", each: true },
  pea: { per: 0.5, unit: "cup" },
  bean: { per: 0.5, unit: "tin" },
  chickpea: { per: 0.5, unit: "tin" },
  lentil: { per: 0.5, unit: "tin" },
  avocado: { per: 0.5, unit: "", each: true },
  cheese: { per: 40, unit: "g" },
  "cream cheese": { per: 1.5, unit: "tbsp" },
  cream: { per: 60, unit: "ml" },
  milk: { per: 60, unit: "ml" },
  yoghurt: { per: 2, unit: "tbsp" },
  halloumi: { per: 60, unit: "g" },
  garlic: { per: 1, unit: "clove", each: true },
  "curry powder": { per: 0.5, unit: "tbsp" },
  "simmer sauce": { per: 0.5, unit: "jar" },
  "soy sauce": { per: 1, unit: "tbsp" },
  sriracha: { per: 1, unit: "tsp" },
  "tomato sauce": { per: 1, unit: "tbsp" },
  mustard: { per: 1, unit: "tsp" },
  gravy: { per: 1, unit: "tbsp" },
  jalapeno: { per: 1, unit: "", each: true },
  lemon: { per: 0.25, unit: "", each: true },
  caper: { per: 1, unit: "tsp" },
  flour: { per: 1, unit: "tbsp" },
};

function tidy(n: number): string {
  if (n >= 10) return String(Math.round(n / 5) * 5);
  const rounded = Math.round(n * 2) / 2;
  if (Number.isInteger(rounded)) return String(rounded);
  if (rounded === 0.5) return "½";
  return String(rounded).replace(".5", "½");
}

/** A pragmatic, visible amount for one ingredient at a given serving count. */
export function amountFor(item: string, servings: number): string {
  const q = QUANTITIES[item] ?? Object.entries(QUANTITIES).find(([k]) => item.includes(k))?.[1];
  if (!q) return `enough ${item} for ${servings}`;
  const total = q.per * servings;
  const amount = tidy(total);
  if (q.each) {
    const unit = q.unit ? ` ${q.unit}${total >= 2 && q.unit ? "s" : ""}` : "";
    return `${amount}${unit} ${item}`;
  }
  return `${amount} ${q.unit} ${item}`.replace(/\s+/g, " ");
}

export function generateSuggestions(input: RescueInput): Suggestion[] {
  const have = input.ingredients;
  const avoid = parseIngredients(input.avoid || "");
  const useUp = parseIngredients(input.useUp || "");
  const servings = servingsFor(input.people);

  const scored = RECIPES.map((recipe) => {
    // STRICT: every core ingredient must be on hand. Nothing is ever "missing".
    const cookable = recipe.core.every((c) => has(have, c));
    const extras = recipe.bonus.filter((b) => has(have, b));

    const blocked = avoid.some(
      (a) => a.length > 2 && [...recipe.core, ...extras].some((i) => i.includes(a) || a.includes(i)),
    );

    let score = recipe.core.length * 30 + extras.length * 9;
    score += useUp.filter((u) => [...recipe.core, ...extras].some((i) => i.includes(u) || u.includes(i))).length * 25;
    score -= Math.abs(EFFORT_ORDER[recipe.effort] - EFFORT_ORDER[input.effort]) * 12;

    const minutes =
      recipe.baseMinutes + (servings >= 4 ? 5 : 0) + (input.effort === "lazy" && recipe.effort === "keen" ? 5 : 0);

    return { recipe, score, used: recipe.core, extras, minutes, servings, cookable, blocked };
  })
    .filter((s) => s.cookable && !s.blocked)
    .sort((a, b) => b.score - a.score || a.minutes - b.minutes)
    .slice(0, 3);

  return scored.map(({ recipe, score, used, extras, minutes }) => ({
    recipe,
    score,
    used,
    extras,
    minutes,
    servings,
  }));
}
