package game

import "testing"

func TestValidateTapFast_AcceptsPlausible(t *testing.T) {
	limits := Limits{MaxTapsPerSecond: 20}
	// 45 taps over 3s = 15/s, well under the cap.
	if err := validateTapFast(45, 3000, limits); err != nil {
		t.Fatalf("plausible score should pass, got %v", err)
	}
}

func TestValidateTapFast_RejectsImpossibleRate(t *testing.T) {
	limits := Limits{MaxTapsPerSecond: 20}
	// 45 taps in 1s = 45/s, far above the cap even with slack.
	if err := validateTapFast(45, 1000, limits); err == nil {
		t.Fatal("impossible tap rate should be rejected")
	}
}

func TestValidateTapFast_RejectsNegativeAndZeroElapsed(t *testing.T) {
	limits := Limits{MaxTapsPerSecond: 20}
	if err := validateTapFast(-1, 3000, limits); err == nil {
		t.Fatal("negative score should be rejected")
	}
	if err := validateTapFast(5, 0, limits); err == nil {
		t.Fatal("zero elapsed time should be rejected")
	}
}

func TestRegistry_EnabledFiltersDisabled(t *testing.T) {
	r := DefaultRegistry()
	if len(r.Enabled()) == 0 {
		t.Fatal("default registry should expose at least one enabled game")
	}
	if _, ok := r.Get(SlugTapFast); !ok {
		t.Fatal("tap-fast should be registered")
	}
}
