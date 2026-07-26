// DATA layer: the rating ladder printed up the side of the reveal meter, the
// way an arcade strength-tester has "Weakling → Champion" painted on its tower.
//
// `from` is the fraction of the tower (0–1) at which the tier starts. Ordered
// weakest-first; the last tier whose `from` a score clears is the one shown.
//
// A tier carries a message KEY, not a label. The ladder is where the rung sits
// and what it is worth; what it says in a given language is the dictionary's
// business (../i18n). Keeping the prose out is also what lets this table double
// as an identity — `labelKey` is a stable React key and a stable equality check
// for "same rung", neither of which survives the text being translated.

import type { MessageKey } from "../i18n";

export interface Tier {
  from: number;
  labelKey: MessageKey;
  icon: string;
}

export const TIERS: Tier[] = [
  { from: 0, labelKey: "reveal.tier.warmingUp", icon: "🌱" },
  { from: 0.2, labelKey: "reveal.tier.notBad", icon: "👍" },
  { from: 0.4, labelKey: "reveal.tier.sharp", icon: "⚡" },
  { from: 0.6, labelKey: "reveal.tier.onFire", icon: "🔥" },
  { from: 0.8, labelKey: "reveal.tier.superstar", icon: "🌟" },
  { from: 0.97, labelKey: "reveal.tier.recordBreaker", icon: "👑" },
];

// REVEAL_DURATION_MS used to live here. It moved to ./pacing, next to the
// celebration beat it plays after — the two are one sequence, and the rule that
// neither may be skipped only reads as a rule when they sit together.
