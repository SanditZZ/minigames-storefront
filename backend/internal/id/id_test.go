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
