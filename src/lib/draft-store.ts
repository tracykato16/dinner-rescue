// Keeps the in-progress ingredient list alive across refreshes and navigation.

const KEY = "dinner-rescue-draft-v1";

export type Draft = {
  raw: string;
  removed: string[];
  people: string;
  effort: string;
  avoid: string;
  useUp: string;
};

export const EMPTY_DRAFT: Draft = {
  raw: "",
  removed: [],
  people: "2",
  effort: "normal",
  avoid: "",
  useUp: "",
};

export function readDraft(): Draft {
  if (typeof window === "undefined") return EMPTY_DRAFT;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_DRAFT;
    return { ...EMPTY_DRAFT, ...(JSON.parse(raw) as Partial<Draft>) };
  } catch {
    return EMPTY_DRAFT;
  }
}

export function writeDraft(draft: Draft) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    /* storage blocked — the prototype keeps working in memory */
  }
}

export function clearDraft() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
