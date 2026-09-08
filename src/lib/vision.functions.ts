import { createServerFn } from "@tanstack/react-start";

/**
 * Conservative photo → ingredient reading.
 *
 * The model only names foods it can clearly see and identify. Anything doubtful
 * is left out entirely: a missed ingredient costs the user one spoken word,
 * while an invented one poisons the whole recipe. Detected names become plain
 * text evidence that the ordinary transcript grounding then treats exactly like
 * spoken words, so nothing bypasses the existing safety rules.
 */
const SYSTEM = `You read photos of a home fridge, freezer, cupboard or pantry and list ONLY the food ingredients you can clearly see and confidently identify.

Rules:
- Confidence over completeness. If you are not sure what something is, or a label/shape is unclear, LEAVE IT OUT. Never guess from context, packaging colour or typical contents.
- Only name what is visible in these photos. Never add likely staples such as water, oil, salt, pepper, butter, milk, flour or sugar unless you can clearly see them.
- One short, plain shopping-list name per item, lower case, no quantities, no brands, no descriptions ("chicken thighs", "carrots", "greek yoghurt", "tin of tomatoes").
- Australian English and Australian names: capsicum (never "bell pepper"), zucchini, eggplant, mince, prawns, coriander. Reserve "pepper" for the seasoning only.
- Combine all photos into one list. No duplicates.
- If you cannot confidently identify any food, return an empty list.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      description: "Clearly visible, confidently identified foods.",
      items: { type: "string" },
    },
  },
  required: ["items"],
} as const;

type Input = { images: string[] };

export const detectFoodsInPhotos = createServerFn({ method: "POST" })
  .inputValidator((input: Input) => {
    if (!input || !Array.isArray(input.images) || input.images.length === 0) {
      throw new Error("Add at least one photo.");
    }
    if (input.images.length > 4) throw new Error("Four photos at a time is plenty.");
    for (const image of input.images) {
      if (typeof image !== "string" || !image.startsWith("data:image/")) {
        throw new Error("That doesn't look like a photo.");
      }
      if (image.length > 8_000_000) throw new Error("That photo is too big — try another.");
    }
    return input;
  })
  .handler(async ({ data }): Promise<{ items: string[] }> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this app (missing LOVABLE_API_KEY).");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "List only the foods you can clearly see and confidently name in these photos.",
              },
              ...data.images.map((url) => ({ type: "image_url", image_url: { url } })),
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "fridge_photo_items", strict: true, schema: SCHEMA },
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
      console.error("vision gateway error", res.status, body);
      throw new Error("I couldn't read that photo. Have another go, or just tell me instead.");
    }

    const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    let parsed: { items?: unknown };
    try {
      parsed = JSON.parse(payload.choices?.[0]?.message?.content ?? "{}");
    } catch {
      throw new Error("I couldn't read that photo. Have another go, or just tell me instead.");
    }

    const seen = new Set<string>();
    const items: string[] = [];
    for (const raw of Array.isArray(parsed.items) ? parsed.items : []) {
      const item = String(raw).toLowerCase().replace(/\s+/g, " ").trim();
      if (!item || item.length > 40 || seen.has(item)) continue;
      seen.add(item);
      items.push(item);
    }
    return { items: items.slice(0, 40) };
  });
