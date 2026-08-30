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
};

export function normalise(raw: string): string {
  const s = raw.trim().toLowerCase().replace(/\s+/g, " ").replace(/\.$/, "");
  return ALIASES[s] ?? (s.endsWith("s") && ALIASES[s.slice(0, -1)] ? ALIASES[s.slice(0, -1)] : s);
}

export function parseIngredients(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(/[,\n;]|\band\b|\+/gi)
        .map((p) => normalise(p.replace(/^(some|a bit of|half a|a|an|the)\s+/i, "")))
        .filter((p) => p.length > 1 && p.length < 40),
    ),
  );
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
