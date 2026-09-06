import { createServerFn } from "@tanstack/react-start";

import { validateAgainstTranscript } from "./dinner-validate";
import type { DinnerOption, DinnerResult } from "./dinner-types";

const SYSTEM = `You are Dinner Rescue, a practical skilled home cook in Australia.
The user's current transcript is the sole source of available ingredients, with exactly one exception: ordinary tap water is always available and may be used in sensible amounts without being mentioned. Assume nothing else — no cooking oil, butter or other fat, no salt or pepper, no stock, garlic, onion, dairy, flour, sugar or sauces unless the transcript states them.
If the transcript explicitly mentions a broad category such as "herbs and spices", "the usual spices" or "seasoning", treat that as permission to use ordinary dry herbs, dry spices and basic seasoning INCLUDING salt and pepper, in sensible culinary quantities. Prefer generic wording such as "season with your herbs and spices" when you don't know exactly which ones they have. That category never permits oil, butter, stock, fresh herbs, fresh aromatics, dairy or sauces.
If no cooking fat was supplied, choose techniques that don't need one rather than sneaking oil or butter in.
Extract only foods explicitly stated as available. Create up to 3 appetising, coherent dinner ideas using only those foods (plus water, plus seasoning if that category was spoken). Think like a good home cook and use the supplied flavour ingredients intelligently — for example Greek yoghurt, garlic and mustard with chicken. Prefer combinations a real person would be pleased to eat. It is better to return one excellent option, or none, than three poor ones. Never suggest shopping, missing ingredients, substitutions, pantry staples, optional garnishes or "if you have" additions. If there is not enough to make a decent meal, say so and ask the user to tell you anything they forgot.

The transcript is messy conversational Australian English: fillers ("um", "I've got", "a little bit of"), pauses, corrections and conjunctions. Treat conjunctions and pauses as separators between distinct foods — "half an avocado and Weet-Bix, Greek yoghurt, garlic" is four separate foods.

Write Australian English. Instructions must be numbered plain steps a tired person can follow, with quantities scaled to the number of people.`;


const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    inventory: {
      type: "array",
      description: "Every food explicitly stated as available, one short name each.",
      items: { type: "string" },
    },
    options: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          minutes: { type: "number" },
          servings: { type: "number" },
          ingredients: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                item: { type: "string" },
                quantity: { type: "string" },
              },
              required: ["item", "quantity"],
            },
          },
          steps: { type: "array", items: { type: "string" } },
        },
        required: ["name", "description", "minutes", "servings", "ingredients", "steps"],
      },
    },
    message: {
      type: ["string", "null"],
      description: "Set only when no decent dinner can be made from the transcript.",
    },
  },
  required: ["inventory", "options", "message"],
} as const;

type Input = {
  transcript: string;
  people: string;
  effort: string;
  avoid?: string;
  useUp?: string;
};

const EFFORT_NOTE: Record<string, string> = {
  lazy: "They can't be bothered tonight: keep it under 20 minutes and as few pans as possible.",
  normal: "A normal weeknight dinner: a bit of chopping is fine, nothing fancy.",
  keen: "They feel like cooking: 35-40 minutes and a bit of technique is welcome.",
};

export const generateDinners = createServerFn({ method: "POST" })
  .inputValidator((input: Input) => {
    if (!input || typeof input.transcript !== "string" || input.transcript.trim().length < 2) {
      throw new Error("Tell me at least one thing you've got.");
    }
    return input;
  })
  .handler(async ({ data }): Promise<DinnerResult> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this app (missing LOVABLE_API_KEY).");

    const people = data.people === "5+" ? "5 or more" : data.people;
    const userPrompt = [
      `Kitchen session transcript (the only food that exists):\n"""${data.transcript.trim()}"""`,
      `Cooking for ${people} ${data.people === "1" ? "person" : "people"}.`,
      EFFORT_NOTE[data.effort] ?? EFFORT_NOTE["normal"],
      data.avoid?.trim() ? `They don't eat: ${data.avoid.trim()}.` : "",
      data.useUp?.trim() ? `Use up first if sensible: ${data.useUp.trim()}.` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "dinner_rescue", strict: true, schema: SCHEMA },
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 402) {
        throw new Error("The AI credits for this prototype have run out. Top them up and try again.");
      }
      if (res.status === 429) {
        throw new Error("The kitchen's a bit busy — give it a few seconds and try again.");
      }
      console.error("AI gateway error", res.status, body);
      throw new Error("I couldn't think of dinners just then. Give it another go.");
    }

    const payload = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content ?? "";
    let parsed: {
      inventory?: string[];
      options?: Omit<DinnerOption, "id">[];
      message?: string | null;
    };
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("I couldn't think of dinners just then. Give it another go.");
    }

    const claimed = (parsed.inventory ?? []).map((i) => String(i).trim()).filter(Boolean);
    const raw = (parsed.options ?? []).map((o, idx) => ({ ...o, id: `opt-${idx + 1}` }));

    // The raw transcript — not the AI's own inventory claim — is the source of truth.
    const checked = validateAgainstTranscript(
      raw as DinnerOption[],
      claimed,
      data.transcript,
    );
    if (checked.rejectedInventory.length > 0) {
      console.warn("ungrounded inventory discarded", checked.rejectedInventory);
    }
    const options = checked.options.slice(0, 3);

    return {
      inventory: checked.inventory,
      options,
      ...(options.length === 0
        ? {
            message:
              parsed.message?.trim() ||
              "I can't make a proper dinner from that list yet — tell me anything you forgot.",
          }
        : {}),
    };
  });
