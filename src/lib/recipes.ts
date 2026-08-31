// Deterministic recipe engine for the Dinner Rescue prototype.
// No AI required: matches typed ingredients against a small recipe library.

export type Effort = "lazy" | "normal" | "keen";

export type RecipeTemplate = {
  id: string;
  name: string;
  effort: Effort;
  baseMinutes: number;
  /** Core ingredients — at least some must be on hand or it becomes a shop trip. */
  core: string[];
  /** Nice-to-have extras that boost the match if present. */
  bonus: string[];
  /** Assumed pantry staples we don't count as shopping. */
  staples: string[];
  blurb: string;
  steps: string[];
};

export type Suggestion = {
  recipe: RecipeTemplate;
  score: number;
  used: string[];
  missing: string[];
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
  "cheddar": "cheese",
  "tasty cheese": "cheese",
  parmesan: "cheese",
  haloumi: "halloumi",
  "beans": "bean",
  "tinned beans": "bean",
  broc: "broccoli",
  "frozen peas": "pea",
  peas: "pea",
  "puff pastry": "pastry",
  "tortillas": "tortilla",
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
  "philadelphia": "cream cheese",
  avocado: "avocado",
  avocados: "avocado",
  "tomato sauce": "tomato",
  "vine ripened tomato": "tomato",
  "tomato vine ripened": "tomato",
  jalapeno: "jalapeno",
  jalapenos: "jalapeno",
  oat: "oat",
  oats: "oat",
  "white rice": "rice",
  "plain flour": "flour",
  "self-raising flour": "flour",
  "self raising flour": "flour",
  "cup a soup": "soup mix",
  "creamy bacon pasta": "pasta side",
  steak: "steak",
  steaks: "steak",
  "rump steak": "steak",
  "porterhouse": "steak",
  "scotch fillet": "steak",
  "chicken bits": "chicken",
  "chicken pieces": "chicken",
  "frozen pea": "pea",
  "gravy mix": "gravy",
  gravy: "gravy",
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
]);

/** Phrases that add nothing but appear constantly in spoken lists. */
const FILLER_PHRASES = [
  /\byou can think of\b/g,
  /\bpretty much\b/g,
  /\ball the\b/g,
  /\bor something\b/g,
  /\bas well\b/g,
  /\bi think\b/g,
  /\bin the (fridge|freezer|pantry|cupboard)\b/g,
  /\bfrom the (fridge|freezer|pantry|cupboard)\b/g,
  /\bor so\b/g,
  /\bleft ?over\b/g,
];

const LEADING_JUNK =
  /^(i'?ve|i'?m|i|we'?ve|we|you|have|has|had|got|get|there'?s|there|is|are|also|plus|then|maybe|just|still|only|about|around|roughly|my|our|the|a|an|of|some|any|little|bit|couple|few|half|lots|loads|heaps|plenty|bunch|dozen|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b\s*/;

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
    .replace(/\b(i'?ve got|i have got|i have|we'?ve got|i got)\b/gi, ",");

  const parts = cleaned.split(/[,;\n\u2022\/]|\band\b|\bplus\b|\balso\b|\bas well as\b|\bthen\b|\+/gi);

  const out: string[] = [];
  for (const part of parts) {
    const item = cleanItem(part);
    if (item && !out.includes(item)) out.push(item);
    if (out.length >= 80) break;
  }
  return out;
}

function matches(have: string[], want: string): boolean {
  return have.some((h) => h.includes(want) || want.includes(h));
}

const R = (r: RecipeTemplate) => r;

export const RECIPES: RecipeTemplate[] = [
  R({
    id: "fried-rice",
    name: "Clean-out-the-fridge fried rice",
    effort: "lazy",
    baseMinutes: 20,
    core: ["rice", "egg"],
    bonus: ["carrot", "pea", "spring onion", "chicken", "bacon", "capsicum", "broccoli", "prawn"],
    staples: ["soy sauce", "oil", "garlic"],
    blurb: "The classic rescue meal. Anything sad in the crisper goes in.",
    steps: [
      "Heat a good splash of oil in your biggest frypan or wok over high heat.",
      "Beat the eggs, pour them in, scramble quickly, then tip them onto a plate.",
      "Fry the harder veg first (carrot, capsicum, broccoli) for 3–4 minutes until just tender.",
      "Add the rice and press it into the pan so it catches and crisps a little.",
      "Return the egg, add any cooked meat, then a good splash of soy sauce. Toss through.",
      "Taste, add more soy or a crack of pepper, and serve straight from the pan.",
    ],
  }),
  R({
    id: "creamy-chicken-spinach",
    name: "Creamy chicken and spinach skillet",
    effort: "normal",
    baseMinutes: 25,
    core: ["chicken", "spinach"],
    bonus: ["cream cheese", "cream", "garlic", "mushroom", "rice", "pasta", "onion"],
    staples: ["oil", "salt", "pepper"],
    blurb: "One pan, silky sauce, no shopping if you've got something creamy.",
    steps: [
      "Cut the chicken into bite-sized pieces and season well with salt and pepper.",
      "Brown the chicken in a hot oiled pan for 5–6 minutes. Don't crowd it.",
      "Add garlic and onion if you have them, cook 1 minute until fragrant.",
      "Stir through the cream cheese (or cream) with a splash of water to loosen it into a sauce.",
      "Add the spinach in handfuls, stirring until it wilts down.",
      "Simmer 3–4 minutes until the chicken is cooked through, then serve over rice or pasta.",
    ],
  }),
  R({
    id: "tray-bake",
    name: "Chuck-it-in tray bake",
    effort: "lazy",
    baseMinutes: 40,
    core: ["potato", "carrot"],
    bonus: ["chicken", "sausage", "pumpkin", "onion", "capsicum", "sweet potato", "chickpea", "broccoli"],
    staples: ["oil", "salt", "pepper"],
    blurb: "Ten minutes of chopping, then the oven does the rest.",
    steps: [
      "Heat the oven to 200°C (180°C fan).",
      "Chop everything into roughly even chunks so it cooks at the same rate.",
      "Toss on a lined tray with plenty of oil, salt and pepper.",
      "Roast 30–35 minutes, giving it a shake halfway.",
      "If you've added chicken or sausages, check they're cooked right through (75°C in the thickest part).",
      "Serve straight off the tray with yoghurt or a squeeze of lemon if you've got it.",
    ],
  }),
  R({
    id: "pasta-bake",
    name: "Anything-goes pasta bake",
    effort: "normal",
    baseMinutes: 35,
    core: ["pasta", "cheese"],
    bonus: ["tomato", "beef mince", "spinach", "onion", "cream", "bacon", "zucchini", "mushroom"],
    staples: ["oil", "garlic", "salt"],
    blurb: "Feeds a crowd, reheats brilliantly, forgives almost anything.",
    steps: [
      "Heat the oven to 200°C and boil the pasta two minutes short of the packet time.",
      "While it cooks, fry the onion and any mince or veg in an oven-proof pan.",
      "Add the tomato (or a splash of cream) and simmer 5 minutes to thicken.",
      "Drain the pasta, saving a cup of the water, and stir it through the sauce with a splash of that water.",
      "Scatter the cheese over the top.",
      "Bake 15 minutes until bubbling and golden. Rest 5 minutes before serving.",
    ],
  }),
  R({
    id: "omelette",
    name: "Big pan omelette with whatever's left",
    effort: "lazy",
    baseMinutes: 12,
    core: ["egg"],
    bonus: ["cheese", "spinach", "mushroom", "tomato", "onion", "bacon", "potato", "capsicum"],
    staples: ["butter", "salt", "pepper"],
    blurb: "Dinner in twelve minutes when you truly cannot be bothered.",
    steps: [
      "Beat the eggs with a pinch of salt until completely smooth.",
      "Cook any veg or bacon in a buttered pan over medium heat until softened.",
      "Pour the eggs over and turn the heat down low.",
      "Drag the set edges into the middle a few times, then leave it alone to set.",
      "Scatter cheese over one half and fold it over.",
      "Slide onto a plate and eat immediately.",
    ],
  }),
  R({
    id: "san-choy-bau",
    name: "Speedy mince stir-fry bowls",
    effort: "normal",
    baseMinutes: 20,
    core: ["beef mince"],
    bonus: ["rice", "carrot", "onion", "garlic", "capsicum", "lettuce", "noodle", "cabbage"],
    staples: ["soy sauce", "oil"],
    blurb: "Big flavour from mince and whatever veg is hanging around.",
    steps: [
      "Get a pan very hot with a little oil.",
      "Brown the mince hard without stirring too much — you want colour, not steam.",
      "Add garlic, onion and any finely chopped veg. Cook 3–4 minutes.",
      "Splash in soy sauce and a spoon of any sweet thing (honey, sauce, jam) to balance it.",
      "Simmer 2 minutes until glossy and the mince is cooked through.",
      "Spoon over rice, noodles or into lettuce cups.",
    ],
  }),
  R({
    id: "soup",
    name: "Bottom-of-the-fridge veg soup",
    effort: "lazy",
    baseMinutes: 30,
    core: ["carrot", "onion"],
    bonus: ["potato", "pumpkin", "celery", "stock", "tomato", "bean", "chickpea", "sweet potato", "cream"],
    staples: ["stock", "oil", "salt"],
    blurb: "The most forgiving way to use up tired vegetables.",
    steps: [
      "Roughly chop everything — it's getting blended or eaten chunky, so don't fuss.",
      "Soften the onion in oil in a large pot for 5 minutes.",
      "Add the rest of the veg and stir for 2 minutes.",
      "Pour in enough stock or water to just cover, then simmer 20 minutes until everything is soft.",
      "Blend smooth, or mash a bit for a chunky soup.",
      "Season generously — soup needs more salt than you think. Add a swirl of cream if you have it.",
    ],
  }),
  R({
    id: "quesadillas",
    name: "Crispy loaded quesadillas",
    effort: "lazy",
    baseMinutes: 15,
    core: ["tortilla", "cheese"],
    bonus: ["bean", "chicken", "capsicum", "onion", "corn", "tomato", "spinach", "beef mince"],
    staples: ["oil"],
    blurb: "Toasty, cheesy and ready before the kettle boils.",
    steps: [
      "Chop your fillings small so the tortilla still folds flat.",
      "Scatter cheese over half a tortilla, add fillings, then more cheese to glue it.",
      "Fold it over and press down.",
      "Cook in a dry or lightly oiled pan over medium heat, 2–3 minutes a side, until golden and crisp.",
      "Rest for a minute so the cheese sets slightly.",
      "Cut into wedges and serve with yoghurt or any sauce you've got.",
    ],
  }),
  R({
    id: "curry",
    name: "House curry with what's on hand",
    effort: "keen",
    baseMinutes: 40,
    core: ["onion", "tomato"],
    bonus: ["chicken", "chickpea", "potato", "cream", "yoghurt", "spinach", "rice", "pumpkin", "cauliflower"],
    staples: ["curry powder", "oil", "garlic", "salt"],
    blurb: "Worth the extra ten minutes. Better the next day, too.",
    steps: [
      "Slice the onion finely and cook slowly in oil for 8–10 minutes until genuinely golden. This is the whole dish.",
      "Add garlic and a heaped tablespoon of curry powder or paste. Stir 1 minute until it smells toasty.",
      "Add the tomato and cook down for 5 minutes into a thick paste.",
      "Add your protein and hardier veg, then enough water or stock to nearly cover.",
      "Simmer gently 20 minutes, uncovered, until thickened and the chicken is cooked through.",
      "Finish with cream or yoghurt off the heat, stir in any greens, and serve with rice.",
    ],
  }),
  R({
    id: "risotto",
    name: "Slow-stirred rice with greens",
    effort: "keen",
    baseMinutes: 35,
    core: ["rice", "stock"],
    bonus: ["mushroom", "spinach", "cheese", "onion", "pea", "cream", "chicken", "zucchini"],
    staples: ["butter", "oil", "garlic", "stock"],
    blurb: "Twenty minutes of stirring, and it's genuinely lovely.",
    steps: [
      "Warm the stock in a small pot and keep it on a low heat.",
      "Soften the onion in butter and oil for 5 minutes without browning.",
      "Add the rice and stir for 2 minutes until the grains look glassy at the edges.",
      "Add the warm stock a ladle at a time, stirring, waiting until each is absorbed. About 18–20 minutes.",
      "Stir through mushrooms or greens for the last 5 minutes.",
      "Off the heat, beat in cheese and a knob of butter. Rest 2 minutes, then serve loose, not stiff.",
    ],
  }),
  R({
    id: "frittata",
    name: "Veg and potato frittata",
    effort: "normal",
    baseMinutes: 30,
    core: ["egg", "potato"],
    bonus: ["cheese", "spinach", "onion", "zucchini", "bacon", "capsicum", "pea", "cream"],
    staples: ["oil", "salt", "pepper"],
    blurb: "Great hot, great cold in tomorrow's lunchbox.",
    steps: [
      "Heat the oven to 190°C.",
      "Slice the potato thinly and fry in an oven-proof pan for 8–10 minutes until nearly tender.",
      "Add the other veg and cook until any water has evaporated.",
      "Beat the eggs with a splash of milk or cream, salt and pepper, and pour over.",
      "Cook on the stove 3 minutes until the edges set, then scatter cheese over.",
      "Bake 12–15 minutes until just set in the middle. Rest 5 minutes before slicing.",
    ],
  }),
  R({
    id: "noodle-soup",
    name: "Ten-minute noodle bowl",
    effort: "lazy",
    baseMinutes: 12,
    core: ["noodle"],
    bonus: ["egg", "stock", "chicken", "spinach", "carrot", "mushroom", "broccoli", "prawn", "cabbage"],
    staples: ["soy sauce", "stock", "garlic"],
    blurb: "Hot, savoury, in the bowl faster than delivery.",
    steps: [
      "Bring stock (or water plus a stock cube and a splash of soy) to the boil.",
      "Add any sliced veg and simmer 3 minutes.",
      "Add the noodles and cook to packet time.",
      "Slide in an egg to poach for the last 3 minutes if you'd like one.",
      "Taste the broth and adjust with soy, pepper or a drop of vinegar.",
      "Tip into a big bowl and eat while it's steaming.",
    ],
  }),
  R({
    id: "tuna-pasta",
    name: "Pantry tuna pasta",
    effort: "lazy",
    baseMinutes: 18,
    core: ["pasta", "tuna"],
    bonus: ["tomato", "onion", "cheese", "spinach", "pea", "cream", "lemon", "garlic"],
    staples: ["oil", "garlic", "salt"],
    blurb: "Nothing fresh in the house? This still works.",
    steps: [
      "Boil the pasta in well-salted water.",
      "Meanwhile, gently warm garlic in olive oil — don't let it brown.",
      "Add the tuna (oil and all) and break it up with a spoon.",
      "Add tomato or a splash of cream, plus a ladle of the pasta water.",
      "Drain the pasta and toss it through the sauce for a minute so it grips.",
      "Finish with cheese, pepper and lemon if you have it.",
    ],
  }),
  R({
    id: "chickpea-braise",
    name: "Warm chickpea and tomato braise",
    effort: "normal",
    baseMinutes: 25,
    core: ["chickpea", "tomato"],
    bonus: ["spinach", "onion", "garlic", "cheese", "egg", "capsicum", "yoghurt", "bread"],
    staples: ["oil", "garlic", "salt", "paprika"],
    blurb: "Cheap, filling and mostly from the cupboard.",
    steps: [
      "Soften onion and garlic in olive oil for 5 minutes.",
      "Add a big pinch of paprika or any spice you like and stir for 30 seconds.",
      "Tip in the tomato and drained chickpeas, plus a splash of water.",
      "Simmer 12–15 minutes until thick and glossy.",
      "Stir through greens, or crack eggs on top and cover until just set.",
      "Season well and serve with bread, rice or yoghurt on the side.",
    ],
  }),
  R({
    id: "roast-veg-bowl",
    name: "Roast veg and grain bowl",
    effort: "normal",
    baseMinutes: 35,
    core: ["pumpkin", "rice"],
    bonus: ["chickpea", "sweet potato", "carrot", "spinach", "cheese", "yoghurt", "couscous", "halloumi"],
    staples: ["oil", "salt", "lemon"],
    blurb: "Roast hard, dress well, pile it into a bowl.",
    steps: [
      "Heat the oven to 220°C.",
      "Cut the veg into chunks, toss with oil and salt and spread on a tray with room between pieces.",
      "Roast 25–30 minutes until deeply caramelised at the edges.",
      "Cook the rice or grain while the oven does its thing.",
      "Mix yoghurt with lemon and a little salt for a quick dressing.",
      "Pile grain, veg and greens into bowls and spoon the dressing over.",
    ],
  }),
  R({
    id: "sausage-lentil",
    name: "Sausages with braised veg",
    effort: "normal",
    baseMinutes: 30,
    core: ["sausage"],
    bonus: ["potato", "onion", "carrot", "tomato", "bean", "cabbage", "stock", "mustard"],
    staples: ["oil", "stock", "salt"],
    blurb: "Proper hearty dinner from a pack of snags.",
    steps: [
      "Brown the sausages all over in a wide pan, then set them aside.",
      "In the same pan, cook onion and chopped veg for 6–8 minutes.",
      "Add tomato or a mug of stock and scrape up the sticky bits.",
      "Return the sausages, cover and simmer 15 minutes.",
      "Check the sausages are cooked right through before serving.",
      "Season, add a spoon of mustard if you have it, and serve.",
    ],
  }),
  R({
    id: "mac-cheese",
    name: "Stovetop mac and cheese",
    effort: "lazy",
    baseMinutes: 20,
    core: ["pasta", "cheese"],
    bonus: ["cream cheese", "milk", "mustard", "flour", "onion", "parmesan", "jalapeno"],
    staples: ["butter", "flour", "milk", "salt", "pepper"],
    blurb: "Pantry only. Cream cheese makes it silky without a white sauce.",
    steps: [
      "Boil the macaroni in well-salted water until just tender, then drain, saving a mug of the water.",
      "In the same pot, melt a knob of butter and stir in the cream cheese with a splash of the pasta water.",
      "Add the grated cheese a handful at a time, stirring until smooth and glossy.",
      "Stir in a small spoon of mustard (powder or wholegrain) — it sharpens the cheese right up.",
      "Return the pasta and toss, loosening with more pasta water until it pours slowly off the spoon.",
      "Season hard with salt and pepper. Chopped jalapeno on top if you like heat.",
    ],
  }),
  R({
    id: "sardine-pasta",
    name: "Sardine and garlic pasta",
    effort: "lazy",
    baseMinutes: 18,
    core: ["pasta", "sardine"],
    bonus: ["anchovy", "garlic", "parmesan", "lemon", "caper", "tomato", "onion"],
    staples: ["olive oil", "garlic", "salt", "pepper"],
    blurb: "Cheap, savoury and entirely from the cupboard.",
    steps: [
      "Boil the pasta in well-salted water and keep a mug of the water back.",
      "Warm plenty of olive oil in a pan with the minced garlic — gently, no browning.",
      "Add the sardines (or anchovies) and break them up so they melt into the oil.",
      "Add capers or a squeeze of lemon, plus a ladle of pasta water, and let it come together.",
      "Toss the drained pasta through for a minute so the sauce grips.",
      "Finish with parmesan and plenty of pepper.",
    ],
  }),
  R({
    id: "nachos",
    name: "Loaded corn chip nachos",
    effort: "lazy",
    baseMinutes: 15,
    core: ["corn chip", "cheese"],
    bonus: ["bean", "lentil", "avocado", "jalapeno", "tomato", "yoghurt", "onion", "beef mince"],
    staples: ["oil", "salt", "paprika"],
    blurb: "Half a bag of chips is a dinner if you treat it like one.",
    steps: [
      "Heat the oven to 200°C and spread the corn chips on a lined tray.",
      "Warm the lentils or beans in a pan with a pinch of paprika and any spices you like.",
      "Spoon the mix over the chips, leaving some chips bare so they stay crisp.",
      "Scatter the cheese over and bake 8–10 minutes until melted.",
      "Top with mashed avocado, sliced pickled onion, jalapeno and a dollop of yoghurt.",
      "Eat straight off the tray while it's hot.",
    ],
  }),
  R({
    id: "simmer-sauce-rice",
    name: "Jar-sauce chicken over rice",
    effort: "lazy",
    baseMinutes: 25,
    core: ["simmer sauce", "rice"],
    bonus: ["chicken", "onion", "carrot", "capsicum", "pea", "lentil", "yoghurt", "spinach"],
    staples: ["oil", "salt"],
    blurb: "A jar in the cupboard is a perfectly good weeknight dinner.",
    steps: [
      "Start the rice so it's ready when the pan is.",
      "Brown the onion and any protein in a little oil for 5–6 minutes.",
      "Add any harder veg and cook another 3 minutes.",
      "Pour in the jar of sauce, swill the jar with a splash of water and add that too.",
      "Simmer 12–15 minutes until thickened and any chicken is cooked right through (75°C).",
      "Stir in greens at the end and spoon over the rice.",
    ],
  }),
  R({
    id: "savoury-oats",
    name: "Savoury oat and egg bowl",
    effort: "lazy",
    baseMinutes: 12,
    core: ["oat", "egg"],
    bonus: ["cheese", "parmesan", "spinach", "onion", "soy sauce", "avocado", "stock", "jalapeno"],
    staples: ["stock", "butter", "salt", "pepper"],
    blurb: "Like a fast risotto. Sounds odd, tastes great.",
    steps: [
      "Bring a mug and a half of stock (or water plus a stock cube) to a simmer.",
      "Stir in the oats and cook 4–5 minutes until thick and creamy.",
      "Beat in cheese or parmesan and a knob of butter, off the heat.",
      "Fry or poach the eggs while the oats sit.",
      "Wilt any greens through the oats, then spoon into bowls.",
      "Top with the eggs, a splash of soy or sriracha, and plenty of pepper.",
    ],
  }),
  R({
    id: "steak-peas",
    name: "Pan steak with buttery peas",
    effort: "normal",
    baseMinutes: 22,
    core: ["steak", "pea"],
    bonus: ["potato", "onion", "mushroom", "gravy", "garlic", "cheese", "rice", "horseradish"],
    staples: ["oil", "butter", "salt", "pepper"],
    blurb: "Cook the steak properly and the sides can be dead simple.",
    steps: [
      "Take the steak out of the fridge, pat it dry and salt both sides generously.",
      "Get a heavy pan smoking hot with a little oil. Lay the steak in and don't touch it for 2–3 minutes.",
      "Flip once, add a knob of butter and any garlic, and spoon the foaming butter over for another 2–3 minutes.",
      "Rest the steak on a warm plate for at least 5 minutes — this is not optional.",
      "Meanwhile, simmer the peas 3 minutes, drain, then crush lightly with butter, salt and pepper.",
      "Make up the gravy with the pan juices stirred in, slice the steak across the grain and serve.",
    ],
  }),
  R({
    id: "chicken-pea-fry",
    name: "Chicken and pea skillet",
    effort: "lazy",
    baseMinutes: 20,
    core: ["chicken", "pea"],
    bonus: ["cream cheese", "onion", "rice", "pasta", "garlic", "cheese", "stock", "curry powder"],
    staples: ["oil", "salt", "pepper"],
    blurb: "Odds and ends of chicken plus frozen peas — a full dinner in one pan.",
    steps: [
      "Cut the chicken into small even pieces and season with salt and pepper.",
      "Brown it in a hot oiled pan for 5–6 minutes without crowding the pan.",
      "Add the onion and garlic and cook 2 minutes until fragrant.",
      "Stir in the cream cheese with a splash of water or stock to make a loose sauce.",
      "Tip in the frozen peas straight from the bag and simmer 4–5 minutes until the chicken is cooked through (75°C).",
      "Taste, season again, and serve over rice or pasta.",
    ],
  }),
];

const EFFORT_ORDER: Record<Effort, number> = { lazy: 0, normal: 1, keen: 2 };

export function servingsFor(people: string): number {
  return people === "5+" ? 5 : Number(people) || 2;
}

export function generateSuggestions(input: RescueInput): Suggestion[] {
  const have = input.ingredients;
  const avoid = parseIngredients(input.avoid || "");
  const useUp = parseIngredients(input.useUp || "");
  const servings = servingsFor(input.people);

  const scored = RECIPES.map((recipe) => {
    const all = [...recipe.core, ...recipe.bonus];
    const used = have.filter((h) => all.some((item) => item.includes(h) || h.includes(item)));
    const missing = recipe.core.filter((item) => !matches(have, item));

    let score = 0;
    score += recipe.core.filter((c) => matches(have, c)).length * 30;
    score += recipe.bonus.filter((b) => matches(have, b)).length * 9;
    score -= missing.length * 34; // strongly favour no-shop options
    score += useUp.filter((u) => matches(all, u)).length * 25;
    score -= Math.abs(EFFORT_ORDER[recipe.effort] - EFFORT_ORDER[input.effort]) * 12;

    const blocked = avoid.some((a) => a.length > 2 && all.some((item) => item.includes(a) || a.includes(item)));

    const minutes =
      recipe.baseMinutes + (servings >= 4 ? 5 : 0) + (input.effort === "lazy" && recipe.effort === "keen" ? 5 : 0);

    return { recipe, score, used, missing, minutes, servings, blocked };
  })
    .filter((s) => !s.blocked && s.used.length > 0)
    .sort((a, b) => b.score - a.score || a.minutes - b.minutes);

  const picked = scored.slice(0, 3);

  if (picked.length < 3) {
    for (const recipe of RECIPES) {
      if (picked.length >= 3) break;
      if (picked.some((p) => p.recipe.id === recipe.id)) continue;
      const all = [...recipe.core, ...recipe.bonus];
      const blocked = avoid.some((a) => a.length > 2 && all.some((item) => item.includes(a) || a.includes(item)));
      if (blocked) continue;
      picked.push({
        recipe,
        score: 0,
        used: have.filter((h) => all.some((item) => item.includes(h) || h.includes(item))),
        missing: recipe.core.filter((item) => !matches(have, item)),
        minutes: recipe.baseMinutes,
        servings,
        blocked: false,
      });
    }
  }

  return picked.map(({ recipe, score, used, missing, minutes }) => ({
    recipe,
    score,
    used,
    missing,
    minutes,
    servings,
  }));
}
