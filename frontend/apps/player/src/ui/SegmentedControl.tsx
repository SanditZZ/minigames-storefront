/**
 * A row of mutually-exclusive choices, one of them selected — the shape a
 * settings toggle takes when there are two or three options and all of them
 * are worth showing at once.
 *
 * It exists as a kit primitive rather than inside the language switcher because
 * it is a control, not a feature: the next thing that needs "pick one of these
 * few" (a leaderboard range, a difficulty) should look identical to the one
 * shipped here rather than being drawn a second time.
 *
 * Accessibility is the reason it is buttons rather than a `<select>`: every
 * option is readable without opening anything, which matters when the options
 * are LANGUAGES and the person reading cannot necessarily read the current one.
 * The group carries the label; each option reports its own selected state via
 * `aria-pressed`, so a screen reader announces "ไทย, pressed" rather than
 * leaving the selection to be inferred from colour.
 */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  className = "",
}: {
  /** Accessible name for the group as a whole ("Language"). */
  label: string;
  value: T;
  options: readonly { value: T; label: string; title?: string }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      // The tokens only: a cream trough with the selected option lifted onto
      // white, matching how Card distinguishes a solid surface from a muted one.
      className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-ink/5 p-1 ${className}`}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            title={option.title}
            onClick={() => onChange(option.value)}
            // min-h-9 rather than the kit's 44px: this sits above the fold as a
            // secondary control, and a full-height pill would compete with the
            // headline underneath it. The horizontal padding keeps the tap
            // target comfortably wide, which is the axis that matters for a
            // two-option row.
            className={`min-h-9 whitespace-nowrap rounded-full px-3 text-sm font-bold outline-none transition focus-visible:ring-4 focus-visible:ring-brand/50 ${
              selected ? "bg-white text-ink shadow-sm" : "text-ink/50 hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
