package id

import (
	"strings"
	"testing"
)

func TestNew_HasTheConfiguredShape(t *testing.T) {
	got := New()
	if len(got) != Length {
		t.Fatalf("New() = %q (%d chars), want %d", got, len(got), Length)
	}
	for _, r := range got {
		if !strings.ContainsRune(Alphabet, r) {
			t.Fatalf("New() = %q contains %q, outside the alphabet", got, r)
		}
	}
}

// Ids land in URLs, so a generated one must never need percent-encoding.
func TestNew_IsURLSafe(t *testing.T) {
	for i := 0; i < 500; i++ {
		got := New()
		for _, r := range got {
			isUnreserved := r == '-' || r == '_' ||
				(r >= '0' && r <= '9') || (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z')
			if !isUnreserved {
				t.Fatalf("New() = %q contains %q, which is not URL-safe", got, r)
			}
		}
	}
}

func TestNew_DoesNotRepeat(t *testing.T) {
	const n = 10000
	seen := make(map[string]bool, n)
	for i := 0; i < n; i++ {
		got := New()
		if seen[got] {
			t.Fatalf("New() produced a duplicate after %d draws: %q", i, got)
		}
		seen[got] = true
	}
}

// --- Claim codes -----------------------------------------------------------

func TestNewClaimCode_HasTheConfiguredShape(t *testing.T) {
	got := NewClaimCode()
	if len(got) != ClaimCodeLength {
		t.Fatalf("NewClaimCode() = %q (%d chars), want %d", got, len(got), ClaimCodeLength)
	}
	for _, r := range got {
		if !strings.ContainsRune(ClaimCodeAlphabet, r) {
			t.Fatalf("NewClaimCode() = %q contains %q, outside the alphabet", got, r)
		}
	}
}

// The whole reason this format exists is that a human reads it off a screen and
// types it at a counter. If a confusable pair ever creeps back into the
// alphabet, that property is silently gone — so assert it directly rather than
// trusting the constant to stay right.
func TestClaimCodeAlphabet_ExcludesConfusablesAndLowercase(t *testing.T) {
	for _, r := range "OI L01" {
		if strings.ContainsRune(ClaimCodeAlphabet, r) {
			t.Fatalf("ClaimCodeAlphabet contains %q, which is confusable with another character", r)
		}
	}
	for _, r := range ClaimCodeAlphabet {
		if r >= 'a' && r <= 'z' {
			t.Fatalf("ClaimCodeAlphabet contains lowercase %q; codes are spoken and typed case-insensitively", r)
		}
	}
	// Both members of every confusable pair must be absent, not just one — that
	// is what makes a mistyped character a typo rather than a different code.
	seen := map[rune]bool{}
	for _, r := range ClaimCodeAlphabet {
		if seen[r] {
			t.Fatalf("ClaimCodeAlphabet repeats %q, which skews the entropy estimate", r)
		}
		seen[r] = true
	}
}

func TestNewClaimCode_DoesNotRepeatInPractice(t *testing.T) {
	// 39 bits is a convenience, not a guarantee — the UNIQUE constraint is the
	// real defence. This only catches a generator that is outright broken.
	const n = 10000
	seen := make(map[string]bool, n)
	for i := 0; i < n; i++ {
		got := NewClaimCode()
		if seen[got] {
			t.Fatalf("NewClaimCode() produced a duplicate after %d draws: %q", i, got)
		}
		seen[got] = true
	}
}

func TestNormalizeClaimCode(t *testing.T) {
	cases := []struct{ name, in, want string }{
		{"already canonical", "ABCD2345", "ABCD2345"},
		{"lowercase", "abcd2345", "ABCD2345"},
		{"the grouping dash the player app renders", "ABCD-2345", "ABCD2345"},
		{"read aloud and typed with spaces", "ABCD 2345", "ABCD2345"},
		{"mixed", " abcd-23 45 ", "ABCD2345"},
		// A mistyped confusable is NOT quietly deleted: dropping it would turn a
		// typo into a shorter string, or worse into a different valid code.
		{"a confusable typo survives to be rejected", "ABCO2345", "ABCO2345"},
		{"empty", "", ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := NormalizeClaimCode(c.in); got != c.want {
				t.Fatalf("NormalizeClaimCode(%q) = %q, want %q", c.in, got, c.want)
			}
		})
	}
}

func TestLooksLikeClaimCode(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want bool
	}{
		{"a minted code", NewClaimCode(), true},
		{"all-alphabet at the right length", "ABCD2345", true},
		{"lowercase (normalize first)", "abcd2345", false},
		{"still grouped (normalize first)", "ABCD-2345", false},
		{"a confusable character", "ABCO2345", false},
		{"a zero", "ABCD2340", false},
		{"one char short", "ABCD234", false},
		{"one char long", "ABCD23456", false},
		{"an entity id", New(), false},
		{"empty", "", false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := LooksLikeClaimCode(c.in); got != c.want {
				t.Fatalf("LooksLikeClaimCode(%q) = %v, want %v", c.in, got, c.want)
			}
		})
	}
}

// The three formats must stay mutually distinguishable: a claim code that
// passed as an entity id (or vice versa) would let one lookup answer another's
// question.
func TestTheThreeFormatsDoNotOverlap(t *testing.T) {
	if Looks(NewClaimCode()) {
		t.Fatalf("a claim code passed Looks() as an entity id")
	}
	if LooksLikeClaimCode(New()) {
		t.Fatalf("an entity id passed LooksLikeClaimCode()")
	}
}

// Looks is what makes the data migration idempotent, so its boundaries matter
// more than they look: a false positive would skip a row that still needs
// converting, a false negative would rewrite one that is already done.
func TestLooks(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want bool
	}{
		{"a minted id", New(), true},
		{"all alphabet chars at the right length", "_-0aZ9bYcXd", true},
		{"a uuid", "9f8b2c1d-4e5a-4b3c-8d7e-1a2b3c4d5e6f", false},
		{"empty", "", false},
		{"one char short", "0123456789", false},
		{"one char long", "0123456789ab", false},
		{"right length, illegal char", "0123456789!", false},
		{"right length, a space", "0123456789 ", false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := Looks(c.in); got != c.want {
				t.Fatalf("Looks(%q) = %v, want %v", c.in, got, c.want)
			}
		})
	}
}
