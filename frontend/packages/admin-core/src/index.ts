// The admin's shared brain — same boundary as @minigames/player-core: no React,
// no `window`, no network.
//
// Worth keeping honest here specifically, because the admin's whole design
// premise is that a view is a URL rather than component state. That premise is
// expressed entirely by pure functions (`parseLocation`, `hrefFor`,
// `clearedFilters`), so it survives onto a platform with no address bar: a
// native client keeps the same Location grammar and swaps only what turns it
// into a screen.

export * from "./awards/filter";
export * from "./claims/present";
export * from "./router/parse";
export * from "./router/routes";
