# Dinner Helper

Build a mobile-first working prototype web app called “Dinner Rescue” for customer validation in Australia. Goal: test one core moment only — a person does not know what to cook for dinner and does not want another trip to the shops.

Keep it deliberately simple and polished enough to hand to 10–20 testers. Do not build login, payments, nutrition tracking, weekly meal planning, grocery integrations, freezer inventory, or other scope creep.

Core flow:
1. Welcome screen: “Dinner Rescue” and headline “Don’t know what to cook? Let’s use what you’ve already got.” Primary button “Rescue my dinner”. Friendly, practical, adult design — not childish, not diet-culture, not influencer-style.
2. Ingredient input screen. For this first MVP, prioritise typed/pasted ingredients and voice-friendly free text. Text prompt: “Tell me what you’ve got in the fridge, freezer or pantry.” Example: “chicken thighs, spinach, carrots, eggs, cream cheese, rice”. Also show a camera/photo button labelled “Photo my fridge” but if full image recognition cannot be made functional immediately, mark it clearly as “Coming soon” rather than faking functionality.
3. Ask: number of people (1,2,3,4,5+), effort tonight with three friendly choices: “Can’t be bothered”, “Normal dinner”, “I feel like cooking”, optional “Anything you don’t eat?” and optional “What needs using up first?”.
4. Generate/show exactly three plausible dinner suggestions using the supplied ingredients. Each card should show meal name, estimated time, which supplied ingredients it uses, and shopping requirement. Strongly prioritise recipes requiring no shopping. Make “No shopping needed” prominent. For prototype reliability, it is acceptable to use deterministic/mock recipe generation based on common ingredient keywords if no AI API is configured, but the experience must be interactive and generate sensible results from user input rather than static identical cards.
5. Selecting a dinner opens a simple recipe/cook view with ingredients and large step-by-step instructions. Include a prominent “I don’t have that” interaction: user can type an ingredient they lack and receive a sensible substitute or an adjusted instruction. For MVP, implement useful substitution rules for common items such as cream, milk, butter, eggs, yoghurt, cheese, garlic, onion, rice, pasta, stock and common vegetables.
6. At the end show validation feedback buttons: “I cooked it”, “Saved me a shop trip”, “Used something that needed using”, “Didn’t help tonight”. Allow multiple positive selections where sensible. Ask optional “What annoyed you or would make this better?” Store feedback locally in browser localStorage for prototype testing and provide a simple hidden/tester-results view reachable from a small footer link where the owner can see aggregate counts and written comments on that device. Also track number of rescue sessions and selected recipes locally.

Australian English throughout. Make the copy conversational but not overloaded with profanity. Responsive/mobile-first, large tap targets, accessible contrast, clean typography. Use warm neutral styling with a subtle food/kitchen feel, but avoid generic restaurant imagery. Include a clear prototype note in the footer: “Testing prototype — recipe suggestions should be checked for allergies and safe cooking temperatures.”

Important validation principle: optimise for speed from opening app to seeing three dinners. We are testing whether people actually use the recommendation, avoid shopping, reduce waste, and return — not whether they admire a complex app.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://dinner-rescue.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/64784b1d-d990-43ac-bd92-1de3aace3c42).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
