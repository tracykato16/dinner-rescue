// Shared, client-safe types for the AI dinner generator.

export type Effort = "lazy" | "normal" | "keen";

export type DinnerIngredient = {
  /** The supplied food, exactly as it appears in the extracted inventory. */
  item: string;
  /** Quantity scaled to the number of people, e.g. "400 g" or "2 cloves". */
  quantity: string;
};

export type DinnerOption = {
  id: string;
  name: string;
  description: string;
  minutes: number;
  servings: number;
  ingredients: DinnerIngredient[];
  steps: string[];
};

export type DinnerResult = {
  /** Foods the AI heard in the transcript — the only permitted ingredients. */
  inventory: string[];
  options: DinnerOption[];
  /** Set when nothing decent can be made from the transcript. */
  message?: string;
};
