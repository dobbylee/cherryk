type ScrollTarget = Pick<HTMLElement, "scrollIntoView">;

export function scrollQuizActionsIntoView(
  target: ScrollTarget | null,
  prefersReducedMotion?: boolean,
) {
  if (!target) {
    return;
  }

  const reduceMotion =
    prefersReducedMotion ??
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  target.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "nearest",
  });
}
