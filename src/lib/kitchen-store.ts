// Persists the kitchen list on this device between rescue sessions.
// No account, no server — just what the user said they still have.

const KEY = "dinner-rescue-kitchen-v1";

export type Kitchen = {
  items: string[];
  updatedAt: string | null;
};

export const EMPTY_KITCHEN: Kitchen = { items: [], updatedAt: null };

export function readKitchen(): Kitchen {
  if (typeof window === "undefined") return EMPTY_KITCHEN;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_KITCHEN;
    const parsed = JSON.parse(raw) as Partial<Kitchen>;
    return {
      items: Array.isArray(parsed.items) ? parsed.items.filter((i) => typeof i === "string") : [],
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
    };
  } catch {
    return EMPTY_KITCHEN;
  }
}

export function writeKitchen(items: string[]) {
  if (typeof window === "undefined") return;
  try {
    if (items.length === 0) {
      window.localStorage.removeItem(KEY);
      return;
    }
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ items, updatedAt: new Date().toISOString() } satisfies Kitchen),
    );
  } catch {
    /* storage blocked — the prototype keeps working in memory */
  }
}

export function clearKitchen() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
