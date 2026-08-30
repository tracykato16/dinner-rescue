import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Camera,
  ChefHat,
  Clock,
  HelpCircle,
  ShoppingCart,
  Sparkles,
  Users,
  Utensils,
  Check,
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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dinner Rescue — Cook with what you've already got" },
      {
        name: "description",
        content:
          "Tell Dinner Rescue what's in your fridge, freezer or pantry and get three dinners tonight — no extra trip to the shops.",
      },
      { property: "og:title", content: "Dinner Rescue — Cook with what you've already got" },
      {
        property: "og:description",
        content:
          "Three dinner ideas from the ingredients you already have. Built for weeknights when the shops are the last place you want to be.",
      },
    ],
  }),
  component: DinnerRescue,
});

type Step = "welcome" | "ingredients" | "details" | "results" | "cook" | "feedback";

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
  const [people, setPeople] = useState("2");
  const [effort, setEffort] = useState<Effort>("normal");
  const [avoid, setAvoid] = useState("");
  const [useUp, setUseUp] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [chosen, setChosen] = useState<Suggestion | null>(null);
  const [lackQuery, setLackQuery] = useState("");
  const [swaps, setSwaps] = useState<{ item: string; advice: string }[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);

  const ingredients = useMemo(() => parseIngredients(raw), [raw]);

  function start() {
    recordSession();
    setStep("ingredients");
  }

  function rescue() {
    setSuggestions(generateSuggestions({ ingredients, people, effort, avoid, useUp }));
    setStep("results");
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
        {step === "welcome" && <Welcome onStart={start} />}

        {step === "ingredients" && (
          <Screen
            title="What have you got?"
            onBack={() => setStep("welcome")}
            stepLabel="Step 1 of 2"
          >
            <label htmlFor="ing" className="block text-base font-medium">
              Tell me what you've got in the fridge, freezer or pantry.
            </label>
            <Textarea
              id="ing"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={5}
              autoFocus
              placeholder="chicken thighs, spinach, carrots, eggs, cream cheese, rice"
              className="mt-3 min-h-32 rounded-xl bg-card p-4 text-base leading-relaxed shadow-[var(--shadow-soft)]"
            />
            <p className="mt-2 text-sm text-muted-foreground">
              Type it, paste it, or use your phone's dictation button — commas or new lines both work.
            </p>

            {ingredients.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {ingredients.map((i) => (
                  <span
                    key={i}
                    className="rounded-full bg-accent px-3 py-1 text-sm text-accent-foreground"
                  >
                    {i}
                  </span>
                ))}
              </div>
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
                  Coming soon — typing is faster for now
                </span>
              </span>
            </button>

            <Button
              variant="hero"
              size="xl"
              className="mt-6 w-full"
              disabled={ingredients.length === 0}
              onClick={() => setStep("details")}
            >
              Next
            </Button>
            {ingredients.length === 0 && (
              <p className="mt-2 text-center text-sm text-muted-foreground">
                Pop in at least one ingredient to get going.
              </p>
            )}
          </Screen>
        )}

        {step === "details" && (
          <Screen
            title="A couple of quick things"
            onBack={() => setStep("ingredients")}
            stepLabel="Step 2 of 2"
          >
            <fieldset>
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

            <fieldset className="mt-7">
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

            <div className="mt-7 space-y-4">
              <div>
                <label htmlFor="avoid" className="block font-medium">
                  Anything you don't eat?{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
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
                  What needs using up first?{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
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

            <Button variant="hero" size="xl" className="mt-7 w-full" onClick={rescue}>
              <Sparkles aria-hidden /> Show me three dinners
            </Button>
          </Screen>
        )}

        {step === "results" && (
          <Screen title="Three dinners for tonight" onBack={() => setStep("details")}>
            <p className="text-sm text-muted-foreground">
              Based on {ingredients.length} ingredient{ingredients.length === 1 ? "" : "s"} you've
              got, for {people === "5+" ? "5 or more" : people}{" "}
              {people === "1" ? "person" : "people"}.
            </p>
            <div className="mt-4 space-y-4">
              {suggestions.map((s) => (
                <SuggestionCard key={s.recipe.id} s={s} onChoose={() => choose(s)} />
              ))}
            </div>
            <Button variant="warm" size="tap" className="mt-5 w-full" onClick={rescue}>
              Not tonight — try again
            </Button>
            <button
              type="button"
              onClick={() => setStep("feedback")}
              className="mt-3 w-full py-3 text-sm text-muted-foreground underline underline-offset-4"
            >
              None of these worked
            </button>
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

            <Button variant="hero" size="xl" className="mt-7 w-full" onClick={() => setStep("feedback")}>
              Done cooking
            </Button>
          </Screen>
        )}

        {step === "feedback" && (
          <Screen title={done ? "Thanks, legend" : "How did that go?"} onBack={() => setStep(chosen ? "cook" : "results")}>
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

function Welcome({ onStart }: { onStart: () => void }) {
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
        Tell us what's in the fridge, freezer or pantry. You'll get three dinners in about a minute —
        no second trip to the shops.
      </p>
      <Button variant="hero" size="xl" className="mt-8 w-full" onClick={onStart}>
        Rescue my dinner
      </Button>
      <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
        <li className="flex items-center gap-2">
          <Check className="size-4 text-success" aria-hidden /> Three ideas, not fifty
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
  return (
    <div className="py-2">
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
