// Package settings holds the CALCULATIONS over admin-configurable knobs: pure
// functions from stored settings to the shapes other layers need. It has no
// database access and no HTTP — the transport layer reads rows and calls in
// here to decide what they mean.
//
// Its whole reason to exist is the allowlist below. Settings are admin data by
// default, and the player app needs only the handful that describe the
// storefront's identity; deciding which in a handler would mean the decision
// lives next to the code most likely to be copy-pasted for the next endpoint.
package settings

import "github.com/sanditzz/minigames-storefront/backend/internal/domain"

// publicKeys is the COMPLETE allowlist of settings readable without the admin
// token. It is a closed allowlist, never a denylist, because the failure modes
// are not symmetric: forgetting to add a key here makes a new feature not work,
// which is noticed immediately, while forgetting to add one to a denylist
// publishes a knob and is noticed by nobody.
//
// Nothing that describes how the store defends itself belongs here. The
// anti-cheat limits (max_taps_per_second, min_reaction_ms) are the thresholds a
// score is rejected above, so publishing them hands a cheater the exact ceiling
// to submit just under; session_ttl_seconds and high_score_limit describe
// server behaviour a player has no use for; claim_ttl_hours is venue policy
// already carried on the claim itself as an absolute expiresAt.
var publicKeys = map[string]bool{
	domain.SettingStoreName:      true,
	domain.SettingStoreTagline:   true,
	domain.SettingStoreLogoURL:   true,
	domain.SettingStoreBannerURL: true,
	// The palette. Public because the player's browser is what applies it —
	// there is no version of "the store picks its colours" that keeps them
	// secret, and a hex triple is not information about the store's defences.
	domain.SettingColorBrand:  true,
	domain.SettingColorBrand2: true,
	domain.SettingColorBrand3: true,
	domain.SettingColorBrand4: true,
	domain.SettingColorInk:    true,
}

// IsPublic reports whether a setting key may be served to an unauthenticated
// client.
func IsPublic(key string) bool { return publicKeys[key] }

// PublicKeys returns the allowlist as a slice, for tests and diagnostics. The
// order is unspecified.
func PublicKeys() []string {
	keys := make([]string, 0, len(publicKeys))
	for k := range publicKeys {
		keys = append(keys, k)
	}
	return keys
}

// Public projects stored settings onto the flat key→value map an
// unauthenticated client receives.
//
// It is deliberately narrower than []domain.Setting: descriptions are prose
// written for an operator and updatedAt is an edit trail, neither of which a
// player app has any use for. Values stay strings — that is how they are
// stored, and every public key is a string knob anyway.
func Public(all []domain.Setting) map[string]string {
	out := make(map[string]string, len(publicKeys))
	for _, s := range all {
		if IsPublic(s.Key) {
			out[s.Key] = s.Value
		}
	}
	return out
}
