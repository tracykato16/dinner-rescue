import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  ChefHat,
  Clock,
  HelpCircle,
  Mic,
  Plus,
  ShoppingCart,
  Sparkles,
  Square,
  Trash2,
  Users,
  Utensils,
  Check,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { PrototypeFooter } from "@/components/PrototypeFooter";
import {
  generateSuggestions,
  parseIngredients,
  type Effort,
  type Suggestion,
} from "@/lib/recipes";
import { findSubstitute } from "@/lib/substitutions";
import { recordFeedback, recordSelection, recordSession } from "@/lib/tester-store";
import { clearDraft, readDraft, writeDraft } from "@/lib/draft-store";
import { useSpeechInput } from "@/hooks/useSpeechInput";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dinner Rescue — Cook with what you've already got" },
      {
        name: "description",
        content:
          "Tell Dinner Rescue what's in your fridge, freezer or pantry — speak it or type it — and get three dinners tonight with no extra trip to the shops.",
      },
      { property: "og:title", content: "Dinner Rescue — Cook with what you've already got" },
      {
        property: "og:description",
        content:
          "Three dinner ideas from the ingredients you already have. Built for weeknights when the shops are the last place you want to be.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DinnerRescue,
});

type Step = "welcome" | "capture" | "confirm" | "results" | "cook" | "feedback";

const EFFORTS: { value: Effort; label: string; hint: string }[] = [
  { value: "lazy", label: "Can't be bothered", hint: "Under 20 minutes, one pan" },
  { value: "normal", label: "Normal dinner", hint: "A bit of chopping, nothing fancy" },
  { value: "keen", label: "I feel like cooking", hint: "Happy to give it 35–40 minutes" },
];

const FEEDBACK_TAGS = [
  { id: "cooked", label: "I cooked it", positive: true },
  { id: "no-shop", label: "Saved me a shop trip", positive: true },
  { id: "used-up", label: "Used something that needed using", positive: true },
  { id: "no-help", label: "Didn't help tonight", positive: false },
];

function DinnerRescue() {
  const [step, setStep] = useState<Step>("welcome");
  const [raw, setRaw] = useState("");
  const [removed, setRemoved] = useState<string[]>([]);
  const [extra, setExtra] = useState("");
  const [people, setPeople] = useState("2");
  const [effort, setEffort] = useState<Effort>("normal");
  const [avoid, setAvoid] = useState("");
  const [useUp, setUseUp] = useState("");
  const [showOptional, setShowOptional] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [generating, setGenerating] = useState(false);
  const [chosen, setChosen] = useState<Suggestion | null>(null);
  const [lackQuery, setLackQuery] = useState("");
  const [swaps, setSwaps] = useState<{ item: string; advice: string }[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);
  const [restored, setRestored] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Restore any draft from a previous visit / accidental refresh.
  useEffect(() => {
    const draft = readDraft();
    setHydrated(true);
    if (!draft.raw.trim()) return;
    setRaw(draft.raw);
    setRemoved(draft.removed ?? []);
    setPeople(draft.people || "2");
    setEffort((draft.effort as Effort) || "normal");
    setAvoid(draft.avoid ?? "");
    setUseUp(draft.useUp ?? "");
    setRestored(true);
  }, []);

  // Keep the draft saved continuously — a long spoken list must never vanish.
  useEffect(() => {
    if (!hydrated) return;
    writeDraft({ raw, removed, people, effort, avoid, useUp });
  }, [hydrated, raw, removed, people, effort, avoid, useUp]);

  const ingredients = useMemo(
    () => parseIngredients(raw).filter((i) => !removed.includes(i)),
    [raw, removed],
  );

  const appendSpeech = useCallback((text: string) => {
    setRaw((prev) => (prev.trim() ? `${prev.replace(/\s*$/, "")}, ${text}` : text));
  }, []);

  const speech = useSpeechInput(appendSpeech);

  function start() {
    recordSession();
    setStep("capture");
  }

  function toConfirm() {
    if (speech.listening) speech.stop();
    setStep("confirm");
  }

  const rescue = useCallback(() => {
    const started = performance.now();
    setGenerating(true);
    const next = generateSuggestions({ ingredients, people, effort, avoid, useUp });
    setSuggestions(next);
    setStep("results");
    // Parsing is local and instant; only show progress if it ever isn't.
    if (performance.now() - started > 500) {
      setTimeout(() => setGenerating(false), 0);
    } else {
      setGenerating(false);
    }
  }, [ingredients, people, effort, avoid, useUp]);

  function addExtra() {
    const text = extra.trim();
    if (!text) return;
    const parsed = parseIngredients(text);
    setRemoved((prev) => prev.filter((r) => !parsed.includes(r)));
    setRaw((prev) => (prev.trim() ? `${prev.replace(/\s*$/, "")}, ${text}` : text));
    setExtra("");
  }

  function clearList() {
    setRaw("");
    setRemoved([]);
    setExtra("");
    setRestored(false);
    clearDraft();
  }

  function choose(s: Suggestion) {
    setChosen(s);
    setSwaps([]);
    setLackQuery("");
    recordSelection(s.recipe.id, s.recipe.name);
    setStep("cook");
  }

  function askSwap() {
    const result = findSubstitute(lackQuery);
    if (!result) return;
    setSwaps((prev) => [result, ...prev.filter((s) => s.item !== result.item)]);
    setLackQuery("");
  }

  function submitFeedback() {
    recordFeedback({
      recipeId: chosen?.recipe.id ?? "none",
      recipeName: chosen?.recipe.name ?? "None selected",
      tags,
      comment: comment.trim(),
    });
    setDone(true);
  }

  function restart() {
    setStep("welcome");
    setChosen(null);
    setTags([]);
    setComment("");
    setDone(false);
    setSwaps([]);
  }

  return (
    <div className="page-warm flex min-h-screen flex-col">
      <main className="mx-auto w-full max-w-xl flex-1 px-5 pb-4 pt-6">
        {step === "welcome" && (
          <Welcome
            onStart={start}
            resumeCount={restored ? ingredients.length : 0}
            onResume={() => setStep("confirm")}
          />
        )}

        {step === "capture" && (
          <Screen
            title="What have you got?"
            onBack={() => setStep("welcome")}
            stepLabel="Step 1 of 2"
          >
            <label htmlFor="ing" className="block text-base font-medium">
              Tell me what you've got in the fridge, freezer or pantry.
            </label>

            {speech.supported ? (
              <div className="mt-3">
                {speech.listening ? (
                  <Button
                    size="xl"
                    variant="warm"
                    className="w-full animate-pulse"
                    onClick={speech.stop}
                  >
                    <Square aria-hidden /> Stop — I'm listening…
                  </Button>
                ) : (
                  <Button size="xl" variant="hero" className="w-full" onClick={speech.start}>
                    <Mic aria-hidden /> Speak my ingredients
                  </Button>
                )}
                <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
                  {speech.listening
                    ? speech.interim
                      ? `Hearing: ${speech.interim}`
                      : "Go for it — just rattle them off. Tap stop when you're done."
                    : "Say them out loud, or type below. Nothing's lost either way."}
                </p>
              </div>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed border-border bg-muted/60 p-4 text-sm text-muted-foreground">
                <Mic className="mr-1 inline size-4" aria-hidden />
                This browser can't listen directly, but the microphone key on your phone keyboard
                works a treat — tap the box below, then the mic on your keyboard.
              </p>
            )}

            {speech.error && (
              <p role="alert" className="mt-2 text-sm font-medium text-destructive">
                {speech.error}
              </p>
            )}

            <Textarea
              id="ing"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={5}
              placeholder="chicken thighs, spinach, carrots, eggs, cream cheese, rice"
              className="mt-4 min-h-32 rounded-xl bg-card p-4 text-base leading-relaxed shadow-[var(--shadow-soft)]"
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Commas, new lines or just talking — all fine.
              </p>
              {raw.trim() !== "" && (
                <button
                  type="button"
                  onClick={clearList}
                  className="shrink-0 py-2 text-sm text-muted-foreground underline underline-offset-4"
                >
                  Clear list
                </button>
              )}
            </div>

            {restored && (
              <p className="mt-3 rounded-xl bg-secondary p-3 text-sm text-secondary-foreground">
                Picked your list back up from last time — edit away.
              </p>
            )}

            <button
              type="button"
              disabled
              aria-disabled="true"
              className="mt-5 flex w-full items-center gap-3 rounded-xl border border-dashed border-border bg-muted/60 p-4 text-left opacity-90"
            >
              <Camera className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0">
                <span className="block font-medium">Photo my fridge</span>
                <span className="block text-sm text-muted-foreground">
                  Coming soon — talking is faster for now
                </span>
              </span>
            </button>

            <Button
              variant="hero"
              size="xl"
              className="mt-6 w-full"
              disabled={ingredients.length === 0}
              onClick={toConfirm}
            >
              Next — check my list
            </Button>
            {ingredients.length === 0 && (
              <p className="mt-2 text-center text-sm text-muted-foreground">
                Pop in at least one ingredient to get going.
              </p>
            )}
          </Screen>
        )}

        {step === "confirm" && (
          <Screen
            title={speech.supported ? "Here's what I heard" : "Here's what you've got"}
            onBack={() => setStep("capture")}
            stepLabel="Step 2 of 2"
          >
            <p className="text-sm text-muted-foreground">
              Tap the <X className="inline size-3.5" aria-hidden /> on anything that's wrong.{" "}
              {ingredients.length} ingredient{ingredients.length === 1 ? "" : "s"} so far.
            </p>

            {ingredients.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {ingredients.map((i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => setRemoved((prev) => [...prev, i])}
                      aria-label={`Remove ${i}`}
                      className="flex min-h-11 items-center gap-2 rounded-full bg-accent px-4 text-base text-accent-foreground"
                    >
                      <span className="capitalize">{i}</span>
                      <X className="size-4 opacity-70" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-xl bg-card p-4 text-base">
                Nothing in the list yet — add something below, or go back and have another go.
              </p>
            )}

            <div className="mt-5">
              <label htmlFor="extra" className="block font-medium">
                Add anything I missed
              </label>
              <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <Input
                  id="extra"
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addExtra();
                    }
                  }}
                  placeholder="frozen peas"
                  className="h-12 rounded-xl bg-card text-base"
                />
                <Button size="tap" onClick={addExtra} disabled={extra.trim().length < 2}>
                  <Plus aria-hidden /> Add
                </Button>
              </div>
              <button
                type="button"
                onClick={clearList}
                className="mt-3 inline-flex items-center gap-2 py-2 text-sm text-muted-foreground underline underline-offset-4"
              >
                <Trash2 className="size-4" aria-hidden /> Clear list
              </button>
            </div>

            <fieldset className="mt-7">
              <legend className="flex items-center gap-2 text-base font-medium">
                <Users className="size-4" aria-hidden /> How many people?
              </legend>
              <div className="mt-3 grid grid-cols-5 gap-2">
                {["1", "2", "3", "4", "5+"].map((p) => (
                  <Button
                    key={p}
                    variant={people === p ? "pillActive" : "pill"}
                    size="tap"
                    className="px-0"
                    aria-pressed={people === p}
                    onClick={() => setPeople(p)}
                  >
                    {p}
                  </Button>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-6">
              <legend className="flex items-center gap-2 text-base font-medium">
                <ChefHat className="size-4" aria-hidden /> How much effort tonight?
              </legend>
              <div className="mt-3 space-y-2">
                {EFFORTS.map((e) => (
                  <button
                    key={e.value}
                    type="button"
                    aria-pressed={effort === e.value}
                    onClick={() => setEffort(e.value)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border-2 p-4 text-left transition-colors ${
                      effort === e.value
                        ? "border-primary bg-card shadow-[var(--shadow-soft)]"
                        : "border-border bg-card/60 hover:bg-secondary"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{e.label}</span>
                      <span className="block text-sm text-muted-foreground">{e.hint}</span>
                    </span>
                    {effort === e.value && (
                      <Check className="size-5 shrink-0 text-primary" aria-hidden />
                    )}
                  </button>
                ))}
              </div>
            </fieldset>

            <button
              type="button"
              onClick={() => setShowOptional((v) => !v)}
              aria-expanded={showOptional}
              className="mt-6 w-full rounded-xl border border-border bg-card/60 p-4 text-left font-medium"
            >
              {showOptional ? "Hide" : "Anything to avoid or use up first?"}{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </button>

            {showOptional && (
              <div className="mt-3 space-y-4">
                <div>
                  <label htmlFor="avoid" className="block font-medium">
                    Anything you don't eat?
                  </label>
                  <Input
                    id="avoid"
                    value={avoid}
                    onChange={(e) => setAvoid(e.target.value)}
                    placeholder="mushrooms, pork"
                    className="mt-2 h-12 rounded-xl bg-card text-base"
                  />
                </div>
                <div>
                  <label htmlFor="useup" className="block font-medium">
                    What needs using up first?
                  </label>
                  <Input
                    id="useup"
                    value={useUp}
                    onChange={(e) => setUseUp(e.target.value)}
                    placeholder="spinach, cream"
                    className="mt-2 h-12 rounded-xl bg-card text-base"
                  />
                </div>
              </div>
            )}

            <Button
              variant="hero"
              size="xl"
              className="mt-7 w-full"
              disabled={ingredients.length === 0 || generating}
              onClick={rescue}
            >
              {generating ? (
                "Working on it…"
              ) : (
                <>
                  <Sparkles aria-hidden /> Looks right — find my dinners
                </>
              )}
            </Button>
          </Screen>
        )}

        {step === "results" && (
          <Screen
            title={suggestions.length >= 3 ? "Three dinners for tonight" : "What I can do tonight"}
            onBack={() => setStep("confirm")}
          >
            <p className="text-sm text-muted-foreground">
              Based on {ingredients.length} ingredient{ingredients.length === 1 ? "" : "s"} you've
              got, for {people === "5+" ? "5 or more" : people}{" "}
              {people === "1" ? "person" : "people"}.
            </p>

            {suggestions.length === 0 ? (
              <NeedMore ingredients={ingredients} onBack={() => setStep("confirm")} />
            ) : (
              <>
                <div className="mt-4 space-y-4">
                  {suggestions.map((s) => (
                    <SuggestionCard key={s.recipe.id} s={s} onChoose={() => choose(s)} />
                  ))}
                </div>
                {suggestions.length < 3 && (
                  <NeedMore
                    ingredients={ingredients}
                    partial
                    onBack={() => setStep("confirm")}
                  />
                )}
                <button
                  type="button"
                  onClick={() => setStep("feedback")}
                  className="mt-4 w-full py-3 text-sm text-muted-foreground underline underline-offset-4"
                >
                  None of these worked
                </button>
              </>
            )}
          </Screen>
        )}

        {step === "cook" && chosen && (
          <Screen title={chosen.recipe.name} onBack={() => setStep("results")}>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Chip icon={<Clock className="size-3.5" aria-hidden />}>
                About {chosen.minutes} min
              </Chip>
              <Chip icon={<Users className="size-3.5" aria-hidden />}>
                Serves {chosen.servings}
              </Chip>
              {chosen.missing.length === 0 ? (
                <NoShopBadge />
              ) : (
                <Chip icon={<ShoppingCart className="size-3.5" aria-hidden />}>
                  Grab: {chosen.missing.join(", ")}
                </Chip>
              )}
            </div>

            <section className="card-soft mt-5 p-5">
              <h2 className="text-lg">What you'll need</h2>
              <ul className="mt-3 space-y-2">
                {chosen.used.map((i) => (
                  <li key={i} className="flex gap-2 text-base">
                    <Check className="mt-1 size-4 shrink-0 text-success" aria-hidden />
                    <span className="capitalize">{i}</span>
                  </li>
                ))}
                {chosen.missing.map((i) => (
                  <li key={i} className="flex gap-2 text-base text-muted-foreground">
                    <ShoppingCart className="mt-1 size-4 shrink-0" aria-hidden />
                    <span className="capitalize">{i}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-muted-foreground">
                Plus the usual cupboard bits: {chosen.recipe.staples.join(", ")}.
              </p>
            </section>

            <section className="mt-6">
              <h2 className="text-lg">Let's cook</h2>
              <ol className="mt-3 space-y-3">
                {chosen.recipe.steps.map((s, idx) => (
                  <li key={idx} className="card-soft flex gap-4 p-4">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-base font-semibold text-primary-foreground">
                      {idx + 1}
                    </span>
                    <p className="min-w-0 text-lg leading-relaxed">{s}</p>
                  </li>
                ))}
              </ol>
            </section>

            <section className="mt-6 rounded-2xl border-2 border-primary/30 bg-warm p-5">
              <h2 className="flex items-center gap-2 text-lg text-warm-foreground">
                <HelpCircle className="size-5" aria-hidden /> I don't have that
              </h2>
              <p className="mt-1 text-sm text-warm-foreground/80">
                Type what you're missing and I'll sort you out.
              </p>
              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <Input
                  value={lackQuery}
                  onChange={(e) => setLackQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") askSwap();
                  }}
                  aria-label="Ingredient you don't have"
                  placeholder="cream"
                  className="h-12 rounded-xl bg-card text-base"
                />
                <Button size="tap" onClick={askSwap} disabled={lackQuery.trim().length < 2}>
                  Swap it
                </Button>
              </div>
              {swaps.length > 0 && (
                <ul className="mt-4 space-y-3">
                  {swaps.map((s) => (
                    <li key={s.item} className="rounded-xl bg-card p-4">
                      <p className="font-medium capitalize">No {s.item}?</p>
                      <p className="mt-1 text-base leading-relaxed">{s.advice}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <Button
              variant="hero"
              size="xl"
              className="mt-7 w-full"
              onClick={() => setStep("feedback")}
            >
              Done cooking
            </Button>
          </Screen>
        )}

        {step === "feedback" && (
          <Screen
            title={done ? "Thanks, legend" : "How did that go?"}
            onBack={() => setStep(chosen ? "cook" : "results")}
          >
            {done ? (
              <div className="card-soft p-6 text-center">
                <Utensils className="mx-auto size-8 text-primary" aria-hidden />
                <p className="mt-3 text-lg">Noted — that's genuinely helpful.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your answers stay on this device for the trial.
                </p>
                <Button variant="hero" size="xl" className="mt-6 w-full" onClick={restart}>
                  Rescue another dinner
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Tick anything that applies — more than one is fine.
                </p>
                <div className="mt-4 space-y-2">
                  {FEEDBACK_TAGS.map((t) => {
                    const active = tags.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                          setTags((prev) =>
                            active
                              ? prev.filter((x) => x !== t.id)
                              : t.positive
                                ? [...prev.filter((x) => x !== "no-help"), t.id]
                                : [t.id],
                          )
                        }
                        className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border-2 px-4 text-left text-base transition-colors ${
                          active
                            ? "border-primary bg-card shadow-[var(--shadow-soft)]"
                            : "border-border bg-card/60 hover:bg-secondary"
                        }`}
                      >
                        <span className="min-w-0">{t.label}</span>
                        {active && <Check className="size-5 shrink-0 text-primary" aria-hidden />}
                      </button>
                    );
                  })}
                </div>

                <label htmlFor="comment" className="mt-6 block font-medium">
                  What annoyed you, or would make this better?{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <Textarea
                  id="comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  placeholder="Be honest — that's the useful bit."
                  className="mt-2 rounded-xl bg-card p-4 text-base"
                />

                <Button
                  variant="hero"
                  size="xl"
                  className="mt-6 w-full"
                  disabled={tags.length === 0 && comment.trim() === ""}
                  onClick={submitFeedback}
                >
                  Send feedback
                </Button>
              </>
            )}
          </Screen>
        )}
      </main>
      <PrototypeFooter />
    </div>
  );
}

function NeedMore({
  ingredients,
  partial,
  onBack,
}: {
  ingredients: string[];
  partial?: boolean;
  onBack: () => void;
}) {
  return (
    <section className="mt-5 rounded-2xl border-2 border-primary/30 bg-warm p-5">
      <h2 className="text-lg text-warm-foreground">
        {partial ? "I can do more with one more clue" : "I can work with this, but I need one more clue"}
      </h2>
      <p className="mt-2 text-base leading-relaxed text-warm-foreground/90">
        {partial
          ? "That's everything that genuinely matches your list — I'd rather show fewer than pretend."
          : `I've got ${ingredients.length} ingredient${ingredients.length === 1 ? "" : "s"} but nothing that adds up to a dinner yet.`}{" "}
        Add a protein (chicken, mince, eggs, tinned fish), a carb (rice, pasta, potatoes, tortillas)
        or a veg and I'll have another go.
      </p>
      <Button variant="hero" size="xl" className="mt-4 w-full" onClick={onBack}>
        <Plus aria-hidden /> Add another ingredient
      </Button>
    </section>
  );
}

function Welcome({
  onStart,
  resumeCount,
  onResume,
}: {
  onStart: () => void;
  resumeCount: number;
  onResume: () => void;
}) {
  return (
    <div className="flex min-h-[78vh] flex-col justify-center py-10">
      <div className="flex items-center gap-2 text-primary">
        <Utensils className="size-5" aria-hidden />
        <span className="text-sm font-semibold uppercase tracking-[0.18em]">Dinner Rescue</span>
      </div>
      <h1 className="mt-6 text-4xl leading-[1.1] sm:text-5xl">
        Don't know what to cook? Let's use what you've already got.
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
        Say or type what's in the fridge, freezer or pantry. You'll get three dinners in about a
        minute — no second trip to the shops.
      </p>
      <Button variant="hero" size="xl" className="mt-8 w-full" onClick={onStart}>
        Rescue my dinner
      </Button>
      {resumeCount > 0 && (
        <Button variant="warm" size="xl" className="mt-3 w-full" onClick={onResume}>
          Pick up my list ({resumeCount} ingredients)
        </Button>
      )}
      <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
        <li className="flex items-center gap-2">
          <Check className="size-4 text-success" aria-hidden /> Speak it — no typing needed
        </li>
        <li className="flex items-center gap-2">
          <Check className="size-4 text-success" aria-hidden /> No shopping wherever possible
        </li>
        <li className="flex items-center gap-2">
          <Check className="size-4 text-success" aria-hidden /> No account, no faff
        </li>
      </ul>
    </div>
  );
}

function Screen({
  title,
  onBack,
  stepLabel,
  children,
}: {
  title: string;
  onBack: () => void;
  stepLabel?: string;
  children: React.ReactNode;
}) {
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => {
    top.current?.scrollIntoView({ block: "start" });
  }, [title]);

  return (
    <div ref={top} className="py-2">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-card"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        <div className="min-w-0">
          {stepLabel && (
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              {stepLabel}
            </p>
          )}
          <h1 className="truncate text-2xl">{title}</h1>
        </div>
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function Chip({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm text-secondary-foreground">
      {icon}
      {children}
    </span>
  );
}

function NoShopBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-success px-3 py-1.5 text-sm font-semibold text-success-foreground">
      <Check className="size-4" aria-hidden /> No shopping needed
    </span>
  );
}

function SuggestionCard({ s, onChoose }: { s: Suggestion; onChoose: () => void }) {
  return (
    <article className="card-soft lift-hover overflow-hidden">
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          {s.missing.length === 0 ? (
            <NoShopBadge />
          ) : (
            <Chip icon={<ShoppingCart className="size-3.5" aria-hidden />}>
              Needs {s.missing.length} item{s.missing.length === 1 ? "" : "s"}
            </Chip>
          )}
          <Chip icon={<Clock className="size-3.5" aria-hidden />}>{s.minutes} min</Chip>
        </div>
        <h2 className="mt-3 text-xl leading-snug">{s.recipe.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{s.recipe.blurb}</p>

        <p className="mt-3 text-sm">
          <span className="font-semibold">Uses your:</span>{" "}
          <span className="text-muted-foreground">
            {s.used.length ? s.used.slice(0, 6).join(", ") : "cupboard staples"}
          </span>
        </p>
        {s.missing.length > 0 && (
          <p className="mt-1 text-sm">
            <span className="font-semibold">You'd need:</span>{" "}
            <span className="text-muted-foreground">{s.missing.join(", ")}</span>
          </p>
        )}

        <Button variant="hero" size="tap" className="mt-4 w-full" onClick={onChoose}>
          Cook this
        </Button>
      </div>
    </article>
  );
}
