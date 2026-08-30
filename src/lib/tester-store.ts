// Local-only prototype analytics. Nothing leaves the device.

const KEY = "dinner-rescue-v1";

export type FeedbackEntry = {
  at: string;
  recipeId: string;
  recipeName: string;
  tags: string[];
  comment: string;
};

export type TesterData = {
  sessions: number;
  selections: { at: string; recipeId: string; recipeName: string }[];
  feedback: FeedbackEntry[];
};

const EMPTY: TesterData = { sessions: 0, selections: [], feedback: [] };

export function readData(): TesterData {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<TesterData>) };
  } catch {
    return EMPTY;
  }
}

function write(data: TesterData) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage full or blocked — prototype carries on */
  }
}

export function recordSession() {
  const data = readData();
  data.sessions += 1;
  write(data);
}

export function recordSelection(recipeId: string, recipeName: string) {
  const data = readData();
  data.selections.push({ at: new Date().toISOString(), recipeId, recipeName });
  write(data);
}

export function recordFeedback(entry: Omit<FeedbackEntry, "at">) {
  const data = readData();
  data.feedback.push({ ...entry, at: new Date().toISOString() });
  write(data);
}

export function clearData() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
