// DATA layer: the rating ladder printed up the side of the reveal meter, the
// way an arcade strength-tester has "Weakling → Champion" painted on its tower.
//
// `from` is the fraction of the tower (0–1) at which the tier starts. Ordered
// weakest-first; the last tier whose `from` a score clears is the one shown.

export interface Tier {
  from: number;
  label: string;
  icon: string;
}

export const TIERS: Tier[] = [
  { from: 0, label: "Warming up", icon: "🌱" },
  { from: 0.2, label: "Not bad", icon: "👍" },
  { from: 0.4, label: "Sharp", icon: "⚡" },
  { from: 0.6, label: "On fire", icon: "🔥" },
  { from: 0.8, label: "Superstar", icon: "🌟" },
  { from: 0.97, label: "Record breaker", icon: "👑" },
];

// REVEAL_DURATION_MS used to live here. It moved to ./pacing, next to the
// celebration beat it plays after — the two are one sequence, and the rule that
// neither may be skipped only reads as a rule when they sit together.
