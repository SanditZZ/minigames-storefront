package settings

import (
	"sort"
	"testing"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
)

// TestOnlyIdentityKeysArePublic pins the allowlist to an exact set rather than
// checking a few members of it. That is the point: adding a key to publicKeys
// must fail this test, so publishing a setting is always a deliberate edit in
// two places and never a one-line slip in the map.
//
// Everything on this list is storefront IDENTITY — what the shop is called and
// what colour it is. That is the rule a new entry has to argue against.
func TestOnlyIdentityKeysArePublic(t *testing.T) {
	want := []string{
		domain.SettingStoreName,
		domain.SettingStoreTagline,
		domain.SettingStoreLogoURL,
		domain.SettingStoreBannerURL,
		domain.SettingColorBrand,
		domain.SettingColorBrand2,
		domain.SettingColorBrand3,
		domain.SettingColorBrand4,
		domain.SettingColorInk,
	}
	got := PublicKeys()
	sort.Strings(want)
	sort.Strings(got)

	if len(got) != len(want) {
		t.Fatalf("public allowlist = %v, want exactly %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("public allowlist = %v, want exactly %v", got, want)
		}
	}
}

// TestOperationalSettingsStayPrivate names each knob that must never reach an
// unauthenticated client, with the reason, so a future edit that publishes one
// fails against a stated rule instead of an opaque count.
func TestOperationalSettingsStayPrivate(t *testing.T) {
	private := map[string]string{
		domain.SettingMaxTapsPerSecond:  "anti-cheat ceiling: publishing it tells a cheater what to submit just under",
		domain.SettingMinReactionMs:     "anti-cheat floor: same",
		domain.SettingSessionTTLSeconds: "server behaviour; a session already carries its own expiresAt",
		domain.SettingHighScoreLimit:    "server behaviour; the leaderboard endpoint takes an explicit limit",
		domain.SettingClaimTTLHours:     "venue policy; a claim already carries an absolute expiresAt",
		domain.SettingAllowReplays:      "server behaviour, enforced server-side",
	}
	for key, why := range private {
		if IsPublic(key) {
			t.Errorf("%q must not be public: %s", key, why)
		}
	}
}

func TestPublicProjectsOnlyAllowlistedValues(t *testing.T) {
	all := []domain.Setting{
		{Key: domain.SettingStoreName, Value: "Corner Cafe", Type: domain.SettingString, Description: "operator prose"},
		{Key: domain.SettingStoreTagline, Value: "Play & win", Type: domain.SettingString},
		{Key: domain.SettingMaxTapsPerSecond, Value: "20", Type: domain.SettingInt},
		{Key: domain.SettingClaimTTLHours, Value: "168", Type: domain.SettingInt},
	}

	got := Public(all)

	if len(got) != 2 {
		t.Fatalf("Public() returned %d keys (%v), want 2", len(got), got)
	}
	if got[domain.SettingStoreName] != "Corner Cafe" {
		t.Errorf("store_name = %q, want %q", got[domain.SettingStoreName], "Corner Cafe")
	}
	if got[domain.SettingStoreTagline] != "Play & win" {
		t.Errorf("store_tagline = %q, want %q", got[domain.SettingStoreTagline], "Play & win")
	}
	if _, leaked := got[domain.SettingMaxTapsPerSecond]; leaked {
		t.Error("anti-cheat limit leaked into the public projection")
	}
}

// An unseeded database is not an error case for the public endpoint: it serves
// an empty object and the client falls back to its built-in identity.
func TestPublicOnEmptyStoreIsEmptyNotNil(t *testing.T) {
	got := Public(nil)
	if got == nil {
		t.Fatal("Public(nil) = nil, want an empty map so it marshals as {} not null")
	}
	if len(got) != 0 {
		t.Fatalf("Public(nil) = %v, want empty", got)
	}
}
