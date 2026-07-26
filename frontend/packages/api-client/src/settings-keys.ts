// Setting keys are part of the wire contract, so they live here beside the
// types rather than in one app's core package: both clients read the store's
// identity — the player to render it, the admin to edit it — and a key spelled
// two ways is a bug that typechecks.
//
// These mirror the Go constants in backend/internal/domain (SettingStoreName
// and friends). The colour keys are the deliberate exception: they live in
// @minigames/tokens next to the palette entries they name, because a native
// client needs the palette without needing an HTTP client.

/** Store name shown to players above the headline. Public. */
export const STORE_NAME_KEY = "store_name";

/** Short line under the headline on the landing screen. Public. */
export const STORE_TAGLINE_KEY = "store_tagline";
