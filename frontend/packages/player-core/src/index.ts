// The player's shared brain: everything the app decides that does not depend on
// how it is drawn.
//
// The boundary is the point of this package, so it is worth stating plainly:
// nothing in here may import React, touch `window`/`document`, or reach the
// network. What survives that rule is what a React Native player app can run
// unchanged — the reveal maths, the rating ladder, the URL grammar, the prize
// merge, the reaction scoring — leaving only rendering and side effects to be
// written twice.
//
// It is also why the routing was built as a pure `parse.ts` plus a thin
// `useRouter.ts` in the first place: the grammar of a location is shared, and
// only the thing that pushes it onto history is per-platform.

export * from "./brand";
export * from "./games/reaction";
export * from "./prizes/merge";
export * from "./reveal/calc";
export * from "./reveal/tiers";
export * from "./router/parse";
export * from "./router/routes";
