// The language a request is answered in is part of the wire contract, so its
// parameter name lives here with the rest of the contract rather than in one
// app's core package — the same argument as settings-keys.ts, and for the same
// reason: a key spelled two ways is a bug that typechecks.
//
// Mirrors i18n.LangParam in backend/internal/i18n, and is deliberately the same
// name the player app uses in its OWN URLs (see LANG_PARAM in
// @minigames/player-core, which re-exports this). One spelling means a kiosk
// pinned to Thai by URL sends requests pinned to Thai, with nothing in between
// having to translate between two names for one idea.

/** Query-string key that asks the API to answer in a given language. */
export const LANG_PARAM = "lang";
