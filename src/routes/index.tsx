import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Check,
  ChefHat,
  Clock,
  Loader2,
  Mic,
  Plus,
  Sparkles,
  Square,
  Trash2,
  Users,
  X,
  Utensils,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { PrototypeFooter } from "@/components/PrototypeFooter";
import { generateDinners } from "@/lib/dinner.functions";
import type { DinnerOption, DinnerResult, Effort } from "@/lib/dinner-types";
import { recordFeedback, recordSelection, recordSession } from "@/lib/tester-store";
import { clearDraft, readDraft, writeDraft } from "@/lib/draft-store";
import { useKitchenRecorder } from "@/hooks/useKitchenRecorder";
import { detectFoodsInPhotos } from "@/lib/vision.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dinner Rescue — Cook with what you've already got" },
      {
        name: "description",
        content:
          "Tell Dinner Rescue what's in your fridge, freezer or pantry — just talk — and get dinners you can cook tonight without a trip to the shops.",
      },
      { property: "og:title", content: "Dinner Rescue — Cook with what you've already got" },
      {
        property: "og:description",
        content:
          "Talk, choose, cook. Dinner ideas built only from the food you already have at home.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DinnerRescue,
});

type Step = "welcome" | "talk" | "choices" | "results" | "cook" | "feedback";

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
  const [extra, setExtra] = useState("");
  const [photoItems, setPhotoItems] = useState<string[]>([]);
  const [photoCount, setPhotoCount] = useState(0);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [people, setPeople] = useState("2");
  const [effort, setEffort] = useState<Effort>("normal");
  const [avoid, setAvoid] = useState("");
  const [useUp, setUseUp] = useState("");
  const [showOptional, setShowOptional] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [result, setResult] = useState<DinnerResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<DinnerOption | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);
  const [restored, setRestored] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Restore any transcript from a previous visit / accidental refresh.
  useEffect(() => {
    const draft = readDraft();
    setHydrated(true);
    setPhotoItems(draft.photoItems ?? []);
    if (!draft.raw.trim() && (draft.photoItems ?? []).length === 0) return;
    setRaw(draft.raw);
    setPhotoItems(draft.photoItems ?? []);
    setPeople(draft.people || "2");
    setEffort((draft.effort as Effort) || "normal");
    setAvoid(draft.avoid ?? "");
    setUseUp(draft.useUp ?? "");
    setRestored(true);
  }, []);

  // Save continuously — a long spoken list must never vanish.
  useEffect(() => {
    if (!hydrated) return;
    writeDraft({ raw, removed: [], photoItems, people, effort, avoid, useUp });
  }, [hydrated, raw, photoItems, people, effort, avoid, useUp]);

  // Photos and talking are both just evidence of what's in the kitchen; the
  // existing grounding layer treats this combined text as the source of truth.
  const evidence = [raw.trim(), photoItems.join(", ")].filter(Boolean).join(". ");

  const appendSpeech = useCallback((text: string) => {
    setRaw((prev) => (prev.trim() ? `${prev.replace(/\s*$/, "")} ${text}` : text));
  }, []);

  const recorder = useKitchenRecorder(appendSpeech);

  function start() {
    recordSession();
    setStep("talk");
  }

  function finishTalking() {
    setStep("choices");
  }

  const rescue = useCallback(async () => {
    setAiError(null);
    setGenerating(true);
    setStep("results");
    try {
      const next = await generateDinners({
        data: { transcript: evidence, people, effort, avoid, useUp },
      });
      setResult(next);
    } catch (error) {
      setResult(null);
      setAiError(
        error instanceof Error && error.message
          ? error.message
          : "I couldn't think of dinners just then. Give it another go.",
      );
    } finally {
      setGenerating(false);
    }
  }, [evidence, people, effort, avoid, useUp]);

  function addExtra() {
    const text = extra.trim();
    if (!text) return;
    setRaw((prev) => (prev.trim() ? `${prev.replace(/\s*$/, "")}, ${text}` : text));
    setExtra("");
  }

  const addPhotos = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      const images = await Promise.all(files.slice(0, 4).map(shrinkImage));
      const found = await detectFoodsInPhotos({ data: { images } });
      setPhotoCount((n) => n + images.length);
      setPhotoItems((prev) => {
        const seen = new Set(prev.map((i) => i.toLowerCase()));
        return [...prev, ...found.items.filter((i) => !seen.has(i.toLowerCase()))];
      });
      if (found.items.length === 0) {
        setPhotoError(
          "I couldn't clearly make out any food in that. Try a closer, brighter photo — or just tell me.",
        );
      }
    } catch (error) {
      setPhotoError(
        error instanceof Error && error.message
          ? error.message
          : "I couldn't read that photo. Have another go, or just tell me instead.",
      );
    } finally {
      setPhotoBusy(false);
    }
  }, []);

  function clearList() {
    setRaw("");
    setExtra("");
    setPhotoItems([]);
    setPhotoCount(0);
    setPhotoError(null);
    setRestored(false);
    setResult(null);
    clearDraft();
  }

  function choose(option: DinnerOption) {
    setChosen(option);
    recordSelection(option.id, option.name);
    setStep("cook");
  }

  function submitFeedback() {
    recordFeedback({
      recipeId: chosen?.id ?? "none",
      recipeName: chosen?.name ?? "None selected",
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
  }

  const options = result?.options ?? [];

  return (
    <div className="page-warm flex min-h-screen flex-col">
      <main className="mx-auto w-full max-w-xl flex-1 px-5 pb-4 pt-6">
        {step === "welcome" && (
          <Welcome
            onStart={start}
            canResume={restored && evidence.trim().length > 1}
            onResume={() => setStep("choices")}
          />
        )}

        {step === "talk" && (
          <Screen title="Tell me what you've got" onBack={() => setStep("welcome")}>
            <p className="text-base leading-relaxed">
              Tap the button, then just talk. Wander between the fridge, freezer and pantry — pause
              as long as you like, it keeps listening. Tap <strong>Done</strong> when you're
              finished.
            </p>

            {recorder.supported ? (
              <div className="mt-6">
                <button
                  type="button"
                  onClick={
                    recorder.phase === "recording"
                      ? recorder.stop
                      : recorder.phase === "idle"
                        ? recorder.start
                        : undefined
                  }
                  aria-label={
                    recorder.phase === "recording" ? "Done talking" : "Tell me what you've got"
                  }
                  aria-pressed={recorder.phase === "recording"}
                  disabled={recorder.phase === "transcribing"}
                  className={`mx-auto grid aspect-square w-full max-w-xs place-items-center rounded-full border-4 transition-colors ${
                    recorder.phase === "recording"
                      ? "animate-pulse border-primary bg-primary/15"
                      : "border-primary bg-primary text-primary-foreground shadow-[var(--shadow-soft)]"
                  }`}
                >
                  <span className="flex flex-col items-center gap-3 px-6 text-center">
                    {recorder.phase === "recording" ? (
                      <Square className="size-14" aria-hidden />
                    ) : recorder.phase === "transcribing" ? (
                      <Loader2 className="size-14 animate-spin" aria-hidden />
                    ) : (
                      <Mic className="size-16" aria-hidden />
                    )}
                    <span className="text-xl font-semibold">
                      {recorder.phase === "recording"
                        ? `Listening… ${formatClock(recorder.seconds)}`
                        : recorder.phase === "transcribing"
                          ? "Writing it down…"
                          : "Tell me what you've got"}
                    </span>
                  </span>
                </button>

                <p className="mt-4 text-center text-base leading-relaxed" aria-live="polite">
                  {recorder.phase === "recording"
                    ? "Take your time — silence is fine. Tap Done when you're finished."
                    : recorder.phase === "transcribing"
                      ? "One moment while I write down everything you said."
                      : "Or type it in below if you'd rather."}
                </p>

                {recorder.phase === "recording" && (
                  <Button variant="hero" size="xl" className="mt-5 w-full" onClick={recorder.stop}>
                    <Check aria-hidden /> Done
                  </Button>
                )}
              </div>
            ) : (
              <p className="mt-5 rounded-xl border border-dashed border-border bg-muted/60 p-4 text-base text-muted-foreground">
                <Mic className="mr-1 inline size-4" aria-hidden />
                This browser can't record directly, but the microphone key on your phone keyboard
                works a treat — tap the box below, then the mic on your keyboard.
              </p>
            )}

            {recorder.error && (
              <p role="alert" className="mt-3 text-sm font-medium text-destructive">
                {recorder.error}
              </p>
            )}

            {recorder.phase === "idle" && (
              <div className="mt-6">
                {recorder.supported && raw.trim() !== "" && (
                  <button
                    type="button"
                    onClick={() => setShowTranscript((v) => !v)}
                    aria-expanded={showTranscript}
                    className="mb-2 py-2 text-sm text-muted-foreground underline underline-offset-4"
                  >
                    {showTranscript ? "Hide what I've got so far" : "Show what I've got so far"}
                  </button>
                )}
                {(!recorder.supported || showTranscript || raw.trim() === "") && (
                  <>
                    <label htmlFor="ing" className="block font-medium">
                      Type or tidy your list
                    </label>
                    <Textarea
                      id="ing"
                      value={raw}
                      onChange={(e) => setRaw(e.target.value)}
                      rows={5}
                      placeholder="chicken thighs, carrots, frozen peas, Greek yoghurt, garlic, rice"
                      className="mt-2 min-h-32 rounded-xl bg-card p-4 text-base leading-relaxed shadow-[var(--shadow-soft)]"
                    />
                    {raw.trim() !== "" && (
                      <button
                        type="button"
                        onClick={clearList}
                        className="mt-2 inline-flex items-center gap-2 py-2 text-sm text-muted-foreground underline underline-offset-4"
                      >
                        <Trash2 className="size-4" aria-hidden /> Clear list
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {restored && (
              <p className="mt-4 rounded-xl bg-secondary p-3 text-sm text-secondary-foreground">
                I've still got what you told me last time — keep going and I'll add to it.
              </p>
            )}

            {recorder.phase === "idle" && (
              <section className="mt-6 rounded-xl border border-border bg-card/60 p-4">
                <h2 className="flex items-center gap-2 text-base font-medium">
                  <Camera className="size-5 shrink-0 text-primary" aria-hidden /> Photo my fridge
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Snap the fridge, freezer or cupboard — I'll only add food I can clearly see. You
                  can add a few photos, then talk about anything I've missed.
                </p>

                <label
                  htmlFor="fridge-photo"
                  className="mt-3 flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-primary bg-card px-4 text-base font-medium text-primary"
                >
                  {photoBusy ? (
                    <>
                      <Loader2 className="size-5 animate-spin" aria-hidden /> Looking at your photo…
                    </>
                  ) : (
                    <>
                      <Camera className="size-5" aria-hidden />
                      {photoCount > 0 ? "Add another photo" : "Take or choose a photo"}
                    </>
                  )}
                </label>
                <input
                  id="fridge-photo"
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  className="sr-only"
                  disabled={photoBusy}
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    e.target.value = "";
                    void addPhotos(files);
                  }}
                />

                {photoError && (
                  <p role="alert" className="mt-3 text-sm font-medium text-destructive">
                    {photoError}
                  </p>
                )}

                {photoItems.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium">
                      From your photos — tap the cross if I got one wrong:
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {photoItems.map((item) => (
                        <li key={item}>
                          <button
                            type="button"
                            onClick={() =>
                              setPhotoItems((prev) => prev.filter((i) => i !== item))
                            }
                            aria-label={`Remove ${item}`}
                            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-secondary px-3 text-sm text-secondary-foreground"
                          >
                            <span className="first-letter:uppercase">{item}</span>
                            <X className="size-4 shrink-0" aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Missed something? Just talk or type it below — no need to check every item.
                    </p>
                  </div>
                )}
              </section>
            )}

            {recorder.phase === "idle" && (
              <Button
                variant="hero"
                size="xl"
                className="mt-6 w-full"
                disabled={evidence.trim().length < 2}
                onClick={finishTalking}
              >
                <Check aria-hidden /> Done — that's everything
              </Button>
            )}
            {evidence.trim().length < 2 && recorder.phase === "idle" && (
              <p className="mt-2 text-center text-sm text-muted-foreground">
                Tell me at least one thing you've got.
              </p>
            )}
          </Screen>
        )}

        {step === "choices" && (
          <Screen title="Almost there" onBack={() => setStep("talk")}>
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
              disabled={evidence.trim().length < 2 || generating}
              onClick={rescue}
            >
              {generating ? (
                "Working on it…"
              ) : (
                <>
                  <Sparkles aria-hidden /> Find my dinners
                </>
              )}
            </Button>
          </Screen>
        )}

        {step === "results" && (
          <Screen
            title={
              generating
                ? "Thinking about dinner"
                : options.length > 0
                  ? "What you can cook tonight"
                  : "Not quite there yet"
            }
            onBack={() => setStep("choices")}
          >
            {generating ? (
              <div className="card-soft grid place-items-center gap-3 p-10 text-center">
                <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
                <p className="text-base" aria-live="polite">
                  Working out what goes together from your list…
                </p>
              </div>
            ) : aiError ? (
              <section className="mt-2 rounded-2xl border-2 border-destructive/40 bg-card p-5">
                <h2 className="text-lg">That didn't work</h2>
                <p className="mt-2 text-base leading-relaxed text-muted-foreground">{aiError}</p>
                <Button variant="hero" size="xl" className="mt-4 w-full" onClick={rescue}>
                  Try again
                </Button>
                <Button
                  variant="warm"
                  size="xl"
                  className="mt-3 w-full"
                  onClick={() => setStep("talk")}
                >
                  <Mic aria-hidden /> Change my list
                </Button>
              </section>
            ) : options.length === 0 ? (
              <NoDinners message={result?.message} onAddMore={() => setStep("talk")} />
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Everything here uses only what you told me you've got, for{" "}
                  {people === "5+" ? "5 or more" : people} {people === "1" ? "person" : "people"}.
                </p>
                <div className="mt-4 space-y-4">
                  {options.map((option) => (
                    <SuggestionCard
                      key={option.id}
                      option={option}
                      onChoose={() => choose(option)}
                    />
                  ))}
                </div>
                <Button
                  variant="warm"
                  size="xl"
                  className="mt-5 w-full"
                  onClick={() => setStep("talk")}
                >
                  <Plus aria-hidden /> Tell me anything I forgot
                </Button>
                <button
                  type="button"
                  onClick={() => setStep("feedback")}
                  className="mt-3 w-full py-3 text-sm text-muted-foreground underline underline-offset-4"
                >
                  None of these worked
                </button>
              </>
            )}
          </Screen>
        )}

        {step === "cook" && chosen && (
          <Screen title={chosen.name} onBack={() => setStep("results")}>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Chip icon={<Clock className="size-3.5" aria-hidden />}>
                About {chosen.minutes} min
              </Chip>
              <Chip icon={<Users className="size-3.5" aria-hidden />}>
                Serves {chosen.servings}
              </Chip>
            </div>

            <section className="card-soft mt-5 p-5">
              <h2 className="text-lg">What you'll use</h2>
              <ul className="mt-3 space-y-2">
                {chosen.ingredients.map((ing) => (
                  <li key={`${ing.item}-${ing.quantity}`} className="flex gap-2 text-base">
                    <Check className="mt-1 size-4 shrink-0 text-success" aria-hidden />
                    <span className="first-letter:uppercase">
                      {ing.quantity} {ing.item}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-6">
              <h2 className="text-lg">Let's cook</h2>
              <ol className="mt-3 space-y-3">
                {chosen.steps.map((s, idx) => (
                  <li key={idx} className="card-soft flex gap-4 p-4">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-base font-semibold text-primary-foreground">
                      {idx + 1}
                    </span>
                    <p className="min-w-0 text-lg leading-relaxed">{s}</p>
                  </li>
                ))}
              </ol>
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

/**
 * Shrinks a photo in the browser before it travels: long edge 1024px, JPEG.
 * Plenty for recognising food, and keeps the upload quick on mobile data.
 */
async function shrinkImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("I couldn't read that photo on this device.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.72);
}

function formatClock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function NoDinners({
  message,
  onAddMore,
}: {
  message?: string | undefined;
  onAddMore: () => void;
}) {
  return (
    <section className="mt-2 rounded-2xl border-2 border-primary/30 bg-warm p-5">
      <h2 className="text-lg text-warm-foreground">
        I can't make a proper dinner from that list yet.
      </h2>
      <p className="mt-2 text-base leading-relaxed text-warm-foreground/90">
        {message ??
          "I'd rather say so than serve you something miserable. Tell me anything else you've got — I'll keep everything you've already said."}
      </p>
      <Button variant="hero" size="xl" className="mt-4 w-full" onClick={onAddMore}>
        <Mic aria-hidden /> Tell me anything I forgot
      </Button>
    </section>
  );
}

function Welcome({
  onStart,
  canResume,
  onResume,
}: {
  onStart: () => void;
  canResume: boolean;
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
        Just talk — tell me what's in the fridge, freezer or pantry. You'll get dinners you can cook
        tonight without going anywhere.
      </p>
      <Button variant="hero" size="xl" className="mt-8 w-full" onClick={onStart}>
        Rescue my dinner
      </Button>
      {canResume && (
        <Button variant="warm" size="xl" className="mt-3 w-full" onClick={onResume}>
          Pick up where I left off
        </Button>
      )}
      <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
        <li className="flex items-center gap-2">
          <Check className="size-4 text-success" aria-hidden /> Talk it — no typing needed
        </li>
        <li className="flex items-center gap-2">
          <Check className="size-4 text-success" aria-hidden /> Only food you already have
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
  children,
}: {
  title: string;
  onBack: () => void;
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

function SuggestionCard({
  option,
  onChoose,
}: {
  option: DinnerOption;
  onChoose: () => void;
}) {
  return (
    <article className="card-soft lift-hover overflow-hidden">
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success px-3 py-1.5 text-sm font-semibold text-success-foreground">
            <Check className="size-4" aria-hidden /> You've got everything
          </span>
          <Chip icon={<Clock className="size-3.5" aria-hidden />}>{option.minutes} min</Chip>
        </div>
        <h2 className="mt-3 text-xl leading-snug">{option.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>

        <p className="mt-3 text-sm">
          <span className="font-semibold">Uses your:</span>{" "}
          <span className="text-muted-foreground">
            {option.ingredients
              .map((i) => i.item)
              .slice(0, 6)
              .join(", ")}
          </span>
        </p>

        <Button variant="hero" size="tap" className="mt-4 w-full" onClick={onChoose}>
          Cook this
        </Button>
      </div>
    </article>
  );
}
