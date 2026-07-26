package claim

import (
	"testing"
	"time"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
)

var base = time.Date(2026, 7, 25, 12, 0, 0, 0, time.UTC)

// issued builds a claim expiring `after` from base, with no redemption.
func issued(after time.Duration) domain.Claim {
	c := domain.Claim{ID: "abc", Code: "ABCD2345", IssuedAt: base}
	if after > 0 {
		c.ExpiresAt = base.Add(after)
	}
	return c
}

func redeemedAt(c domain.Claim, t time.Time) domain.Claim {
	c.RedeemedAt = &t
	return c
}

// The boundaries are the whole point of deriving status rather than storing it,
// so they are asserted to the nanosecond.
func TestStatusAt(t *testing.T) {
	hour := time.Hour
	cases := []struct {
		name  string
		claim domain.Claim
		now   time.Time
		want  domain.ClaimStatus
	}{
		{"well inside the window", issued(hour), base.Add(30 * time.Minute), domain.ClaimIssued},
		{"at the instant of issue", issued(hour), base, domain.ClaimIssued},
		{
			// Matches app.SubmitScore's session rule (now.After), so "expired"
			// means one thing everywhere in the repo.
			"exactly at expiry is still valid",
			issued(hour), base.Add(hour), domain.ClaimIssued,
		},
		{"one nanosecond past expiry", issued(hour), base.Add(hour + 1), domain.ClaimExpired},
		{"long past expiry", issued(hour), base.Add(400 * 24 * hour), domain.ClaimExpired},
		{"a zero ExpiresAt never expires", issued(0), base.Add(400 * 24 * hour), domain.ClaimIssued},
		{"redeemed while still valid", redeemedAt(issued(hour), base.Add(time.Minute)), base.Add(2 * time.Minute), domain.ClaimRedeemed},
		{
			// Redemption outranks expiry: the prize was actually collected, and
			// reporting it as expired would misdescribe what happened.
			"redeemed in time, inspected long after expiry",
			redeemedAt(issued(hour), base.Add(time.Minute)), base.Add(400 * 24 * hour), domain.ClaimRedeemed,
		},
		{
			"redeemed after its expiry (a store that let it through)",
			redeemedAt(issued(hour), base.Add(2*hour)), base.Add(3 * hour), domain.ClaimRedeemed,
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := StatusAt(c.claim, c.now); got != c.want {
				t.Fatalf("StatusAt() = %q, want %q", got, c.want)
			}
		})
	}
}

func TestCanRedeem(t *testing.T) {
	hour := time.Hour
	cases := []struct {
		name       string
		claim      domain.Claim
		now        time.Time
		wantOK     bool
		wantReason string
	}{
		{"outstanding", issued(hour), base.Add(time.Minute), true, ""},
		{"exactly at expiry", issued(hour), base.Add(hour), true, ""},
		{"just expired", issued(hour), base.Add(hour + 1), false, ReasonExpired},
		{"never expires", issued(0), base.Add(10 * 365 * 24 * hour), true, ""},
		{
			"redeem twice",
			redeemedAt(issued(hour), base.Add(time.Minute)), base.Add(2 * time.Minute),
			false, ReasonAlreadyRedeemed,
		},
		{
			// Both refusals apply; the redeemed one is reported, because it is
			// the more informative thing to tell someone at a counter.
			"redeemed AND expired",
			redeemedAt(issued(hour), base.Add(time.Minute)), base.Add(2 * hour),
			false, ReasonAlreadyRedeemed,
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			ok, reason := CanRedeem(c.claim, c.now)
			if ok != c.wantOK || reason != c.wantReason {
				t.Fatalf("CanRedeem() = (%v, %q), want (%v, %q)", ok, reason, c.wantOK, c.wantReason)
			}
		})
	}
}

// The inverse's only precondition is that a redemption happened. Expiry is NOT
// one, which these cases pin: a claim collected inside its window and corrected
// after it must still be correctable.
func TestCanUnredeem(t *testing.T) {
	hour := time.Hour
	cases := []struct {
		name       string
		claim      domain.Claim
		wantOK     bool
		wantReason string
	}{
		{"collected", redeemedAt(issued(hour), base.Add(time.Minute)), true, ""},
		{"collected, and its window has since closed", redeemedAt(issued(hour), base.Add(time.Minute)), true, ""},
		{"never collected", issued(hour), false, ReasonNotRedeemed},
		{"never collected and long expired", issued(hour), false, ReasonNotRedeemed},
		{"never collected, never expires", issued(0), false, ReasonNotRedeemed},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			ok, reason := CanUnredeem(c.claim)
			if ok != c.wantOK || reason != c.wantReason {
				t.Fatalf("CanUnredeem() = (%v, %q), want (%v, %q)", ok, reason, c.wantOK, c.wantReason)
			}
		})
	}
}

func TestTTL(t *testing.T) {
	cases := []struct {
		hours int
		want  time.Duration
	}{
		{domain.DefaultClaimTTLHours, 168 * time.Hour},
		{1, time.Hour},
		// A missing or fat-fingered setting must not kill a claim on issue.
		{0, 0},
		{-5, 0},
	}
	for _, c := range cases {
		if got := TTL(c.hours); got != c.want {
			t.Fatalf("TTL(%d) = %v, want %v", c.hours, got, c.want)
		}
	}
}

func TestIssue(t *testing.T) {
	score := domain.ScoreEntry{ID: "score-id", CreatedAt: base}
	award := domain.Award{ID: "award-id", Name: "Free Coffee"}

	got := Issue("claim-id", "ABCD2345", score, award, 48*time.Hour)

	if got.ID != "claim-id" || got.Code != "ABCD2345" {
		t.Fatalf("Issue() identity = (%q, %q)", got.ID, got.Code)
	}
	if got.ScoreID != "score-id" || got.AwardID != "award-id" {
		t.Fatalf("Issue() links = (%q, %q)", got.ScoreID, got.AwardID)
	}
	// The snapshot is the bug fix: deleting the award must not rewrite this.
	if got.AwardName != "Free Coffee" {
		t.Fatalf("Issue() AwardName = %q, want the award's name copied", got.AwardName)
	}
	// The window starts when the round ended, not at some later clock reading.
	if !got.IssuedAt.Equal(base) {
		t.Fatalf("Issue() IssuedAt = %v, want the score's CreatedAt %v", got.IssuedAt, base)
	}
	if !got.ExpiresAt.Equal(base.Add(48 * time.Hour)) {
		t.Fatalf("Issue() ExpiresAt = %v, want issue + ttl", got.ExpiresAt)
	}
	if got.RedeemedAt != nil {
		t.Fatalf("Issue() RedeemedAt = %v, want nil", got.RedeemedAt)
	}
	if StatusAt(got, base) != domain.ClaimIssued {
		t.Fatalf("a freshly issued claim is not issued")
	}
}

func TestIssue_ZeroTTLLeavesNoExpiry(t *testing.T) {
	score := domain.ScoreEntry{ID: "s", CreatedAt: base}
	got := Issue("c", "ABCD2345", score, domain.Award{ID: "a", Name: "Mug"}, TTL(0))

	if !got.ExpiresAt.IsZero() {
		t.Fatalf("Issue() with a zero TTL set ExpiresAt = %v, want the zero time", got.ExpiresAt)
	}
	if StatusAt(got, base.Add(10*365*24*time.Hour)) != domain.ClaimIssued {
		t.Fatalf("a claim with no expiry expired anyway")
	}
}

// Status cannot be a SQL WHERE clause, so this filter is the admin list's
// only correct route to "show me the outstanding ones".
func TestFilter(t *testing.T) {
	hour := time.Hour
	now := base.Add(2 * hour)
	claims := []domain.Claim{
		{ID: "live", IssuedAt: base, ExpiresAt: base.Add(9 * hour)},
		{ID: "dead", IssuedAt: base, ExpiresAt: base.Add(hour)},
		{ID: "done", IssuedAt: base, ExpiresAt: base.Add(9 * hour), RedeemedAt: &base},
		{ID: "forever", IssuedAt: base},
	}

	cases := []struct {
		status domain.ClaimStatus
		want   []string
	}{
		{domain.ClaimIssued, []string{"live", "forever"}},
		{domain.ClaimExpired, []string{"dead"}},
		{domain.ClaimRedeemed, []string{"done"}},
		{"", []string{"live", "dead", "done", "forever"}},
	}
	for _, c := range cases {
		t.Run(string(c.status), func(t *testing.T) {
			got := Filter(claims, c.status, now)
			if len(got) != len(c.want) {
				t.Fatalf("Filter(%q) returned %d claims, want %d", c.status, len(got), len(c.want))
			}
			for i, id := range c.want {
				if got[i].ID != id {
					t.Fatalf("Filter(%q)[%d] = %q, want %q (order must be preserved)", c.status, i, got[i].ID, id)
				}
			}
		})
	}
}
