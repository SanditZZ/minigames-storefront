// The web player's routing surface: the shared URL grammar plus the one hook
// that touches the browser.
//
// The grammar itself now lives in @minigames/player-core, because a Location is
// the same idea on any platform — it is only `useRouter` below, which reads
// window.location and pushes onto history, that a native client has to replace.
// Re-exported through here so screens keep importing "../router" and never need
// to know which side of that line a symbol falls on.

export {
  hrefFor,
  isSafeSegment,
  parseLocation,
  parsePath,
  parsePlayerName,
  parseReveal,
  pathFor,
  sameLocation,
  MAX_NAME_LENGTH,
  NAME_PARAM,
  REVEAL_PARAM,
  type Location,
  type Route,
} from "@minigames/player-core";
export { useRouter, type NavOptions, type Router } from "./useRouter";
