import { Link } from "@tanstack/react-router";

export function PrototypeFooter() {
  return (
    <footer className="mx-auto w-full max-w-xl px-5 pb-10 pt-8 text-center">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Testing prototype — recipe suggestions should be checked for allergies and safe cooking
        temperatures.
      </p>
      <Link
        to="/tester-results"
        className="mt-3 inline-block text-[11px] text-muted-foreground/70 underline underline-offset-4 hover:text-foreground"
      >
        ·
      </Link>
    </footer>
  );
}
