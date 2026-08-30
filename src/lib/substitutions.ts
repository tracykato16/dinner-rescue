import { normalise } from "./recipes";

type Rule = { keys: string[]; swap: string };

const RULES: Rule[] = [
  { keys: ["cream", "thickened cream", "sour cream"], swap: "Use full-fat milk with a spoon of butter stirred in, or cream cheese loosened with water. Yoghurt works too — take the pan off the heat first so it doesn't split." },
  { keys: ["milk"], swap: "Water plus a knob of butter does the job in most sauces. Or thin down yoghurt, cream or evaporated milk." },
  { keys: ["butter"], swap: "Any neutral oil or olive oil, roughly the same amount. For baking-style richness, use a little more oil than the butter called for." },
  { keys: ["egg", "eggs"], swap: "If it's for binding, mash a bit of potato, or use 2 tablespoons of yoghurt per egg. If eggs are the main event, skip this recipe and go for a stir-fry or pasta instead." },
  { keys: ["yoghurt", "yogurt"], swap: "Sour cream, cream cheese thinned with water, or plain milk with a squeeze of lemon left to sit for a minute." },
  { keys: ["cheese", "cheddar", "parmesan", "tasty cheese"], swap: "Any melting cheese you've got works. No cheese at all? Finish with a knob of butter and extra pepper for the same richness." },
  { keys: ["cream cheese"], swap: "Cream, sour cream, or thick yoghurt stirred in off the heat. Add it slowly so the sauce stays smooth." },
  { keys: ["garlic"], swap: "A teaspoon of garlic powder, or just use extra onion. Not the same, but nobody will complain." },
  { keys: ["onion"], swap: "Spring onion, leek, or a teaspoon of onion powder. In a pinch, a little extra garlic carries the flavour." },
  { keys: ["rice"], swap: "Pasta, couscous, noodles, quinoa or even bread on the side. Cook it separately and treat it as the base." },
  { keys: ["pasta"], swap: "Rice, noodles or gnocchi. Just adjust the cooking time to the packet and keep a cup of the cooking water for the sauce." },
  { keys: ["noodle", "noodles"], swap: "Spaghetti broken in half works fine, or rice." },
  { keys: ["stock", "stock cube", "chicken stock", "beef stock", "vegetable stock"], swap: "Water plus a splash of soy sauce, a spoon of miso, or a squeeze of tomato paste. Season a bit more than usual." },
  { keys: ["tomato", "tinned tomatoes", "passata"], swap: "Two tablespoons of tomato paste plus a cup of water, or tomato pasta sauce from a jar." },
  { keys: ["tomato paste"], swap: "A few tablespoons of tomato sauce (ketchup) — cut back on any added sugar or sweetener." },
  { keys: ["lemon", "lime"], swap: "A splash of vinegar (white, apple cider or even red wine) gives you the same lift." },
  { keys: ["spinach", "silverbeet", "kale"], swap: "Any green: shredded cabbage, frozen peas, chopped broccoli, or lettuce wilted in right at the end." },
  { keys: ["carrot"], swap: "Pumpkin, sweet potato, capsicum or celery. Match the size of the pieces so the timing holds." },
  { keys: ["potato"], swap: "Sweet potato, pumpkin or even tinned chickpeas for something starchy and filling." },
  { keys: ["capsicum"], swap: "Zucchini, celery, mushroom or extra onion." },
  { keys: ["mushroom"], swap: "Zucchini or eggplant for texture. For the savoury depth, add a splash of soy sauce." },
  { keys: ["broccoli", "cauliflower"], swap: "Any firm veg cut small: beans, zucchini, cabbage or frozen peas added near the end." },
  { keys: ["chicken"], swap: "Pork, turkey, firm tofu, tinned chickpeas or mushrooms. Keep the cooking time similar and check meat is cooked right through." },
  { keys: ["beef mince", "mince"], swap: "Chicken mince, lentils (tinned, drained) or crumbled firm tofu. Brown it hard either way." },
  { keys: ["sausage", "sausages"], swap: "Bacon, mince rolled into rough balls, or tinned beans for a meat-free version." },
  { keys: ["bacon"], swap: "Ham, chorizo, or a splash of soy sauce plus smoked paprika for that savoury note." },
  { keys: ["soy sauce"], swap: "Worcestershire sauce, fish sauce, or salt plus a tiny bit of something sweet." },
  { keys: ["tortilla", "wrap"], swap: "Bread, pita, or serve everything over rice as a bowl instead." },
  { keys: ["oil"], swap: "Butter, or a nonstick pan with a splash of water for the veg." },
  { keys: ["curry powder", "curry paste"], swap: "Mix cumin, coriander, paprika and a pinch of turmeric. Chilli flakes if you want heat." },
  { keys: ["chickpea", "chickpeas", "bean", "beans"], swap: "Any tinned pulse — lentils, cannellini, kidney beans. Or bulk it out with extra veg and rice." },
  { keys: ["pea", "peas"], swap: "Any frozen veg, or finely chopped green beans, zucchini or cabbage." },
  { keys: ["bread"], swap: "Rice, couscous, or toast whatever's in the freezer. Even crackers on the side do the trick." },
];

export function findSubstitute(raw: string): { item: string; advice: string } | null {
  const query = normalise(raw);
  if (query.length < 2) return null;
  for (const rule of RULES) {
    if (rule.keys.some((k) => k === query || k.includes(query) || query.includes(k))) {
      return { item: raw.trim(), advice: rule.swap };
    }
  }
  return {
    item: raw.trim(),
    advice:
      "No specific swap for that one. Leave it out and add a little more of something similar you do have — most of these dinners survive a missing ingredient. Taste at the end and season properly.",
  };
}
