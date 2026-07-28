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
//
// `iconKey` is the same arrangement for the mark beside the label, and for the
// same reason: a rung used to carry an emoji, which is a rendered GLYPH sitting
// in a package that must not hold anything platform-specific. A name from
// `@minigames/icons` is data — the web app draws it as `<svg>`, a phone would
// draw it with `react-native-svg`, and this table does not have to know which.

import type { IconName } from "@minigames/icons";
import type { MessageKey } from "../i18n";

export interface Tier {
  from: number;
  labelKey: MessageKey;
  iconKey: IconName;
}

export const TIERS: Tier[] = [
  { from: 0, labelKey: "reveal.tier.warmingUp", iconKey: "plant" },
  { from: 0.2, labelKey: "reveal.tier.notBad", iconKey: "thumbs-up" },
  { from: 0.4, labelKey: "reveal.tier.sharp", iconKey: "lightning" },
  { from: 0.6, labelKey: "reveal.tier.onFire", iconKey: "fire" },
  { from: 0.8, labelKey: "reveal.tier.superstar", iconKey: "star" },
  { from: 0.97, labelKey: "reveal.tier.recordBreaker", iconKey: "crown" },
];

// REVEAL_DURATION_MS used to live here. It moved to ./pacing, next to the
// celebration beat it plays after — the two are one sequence, and the rule that
// neither may be skipped only reads as a rule when they sit together.
