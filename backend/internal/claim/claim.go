// Package claim is a CALCULATIONS layer: the pure lifecycle rules for a prize
// claim. Given a claim and a point in time it says what state that claim is in
// and whether it may be redeemed. It performs no I/O, mints no ids, and reads
// no clock — the caller supplies `now`, which is what makes every boundary here
// (expiry to the nanosecond, redeem-twice, redeem-after-expiry) testable
// without waiting for real time to pass.
//
// The action half — writing the row, enforcing single redemption atomically —
// lives in the store and the app service. This package never decides that a
// redemption HAPPENED, only that one WOULD BE legal.
package claim

import (
	"time"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
)

// Why redemption was refused. Returned alongside the boolean so a caller can
// say something true to an admin at a counter rather than a bare "no".
const (
	ReasonAlreadyRedeemed = "this claim has already been redeemed"
	ReasonExpired         = "this claim has expired"
)

// TTL converts the admin-configured claim window (in hours) to a duration.
//
// Zero or negative means "never expires" rather than "expires immediately".
// That reading is deliberate: the setting is typed as a plain int, so a missing
// or fat-fingered value lands on 0, and the safe failure for a prize a player
// legitimately won is a claim that stays valid, not one that is dead on issue.
func TTL(hours int) time.Duration {
	if hours <= 0 {
		return 0
	}
	return time.Duration(hours) * time.Hour
}

// Issue builds the claim a winning round earns.
//
// The id and the code are parameters rather than minted here: both draw on the
// CSPRNG, which is an action, and this package stays pure. The caller gets them
// from internal/id.
//
// The claim's clock starts at score.CreatedAt, not at a separately-read `now`.
// The claim is issued as part of writing the score, so one clock reading covers
// both — and the redemption window then begins exactly when the round ended,
// which is the moment the player would describe as "when I won it".
//
// AwardName is copied, not referenced. See the note on domain.Claim: an award
// deleted later must not rewrite what a permanent result URL says was won.
func Issue(claimID, code string, score domain.ScoreEntry, award domain.Award, ttl time.Duration) domain.Claim {
	c := domain.Claim{
		ID:        claimID,
		Code:      code,
		ScoreID:   score.ID,
		AwardID:   award.ID,
		AwardName: award.Name,
		IssuedAt:  score.CreatedAt,
	}
	if ttl > 0 {
		c.ExpiresAt = score.CreatedAt.Add(ttl)
	}
	return c
}

// StatusAt derives a claim's state. This is the single definition of
// issued/redeemed/expired in the system — nothing persists a status column, so
// there is no second answer that can drift out of agreement with this one.
//
// Redemption outranks expiry: a claim handed over on Monday and inspected the
// following month still reads "redeemed". Expiry describes a window that closed
// with the prize UNCOLLECTED, and reporting a collected prize as expired would
// misdescribe a transaction that actually took place.
//
// The boundary matches the session rule in app.SubmitScore (`now.After(...)`):
// a claim inspected at the exact nanosecond of its expiry is still valid, and
// only the instant after is not. One convention for "expired" across the repo.
func StatusAt(c domain.Claim, now time.Time) domain.ClaimStatus {
	if c.RedeemedAt != nil {
		return domain.ClaimRedeemed
	}
	if !c.ExpiresAt.IsZero() && now.After(c.ExpiresAt) {
		return domain.ClaimExpired
	}
	return domain.ClaimIssued
}

// CanRedeem reports whether a claim may be handed over now, and if not, why.
//
// It is derived from StatusAt rather than re-deriving the conditions, so the
// two can never disagree about a claim that is on a boundary.
func CanRedeem(c domain.Claim, now time.Time) (bool, string) {
	switch StatusAt(c, now) {
	case domain.ClaimRedeemed:
		return false, ReasonAlreadyRedeemed
	case domain.ClaimExpired:
		return false, ReasonExpired
	default:
		return true, ""
	}
}

// Filter returns the claims in `status` at `now`, preserving order.
//
// This exists because status is derived, which has a consequence worth stating:
// an admin list cannot be filtered by status in SQL. A `WHERE status = ?` would
// have to re-implement StatusAt in the query language, which is exactly the
// second source of truth the design avoids. The store lists rows; this decides
// what they are.
//
// An empty status means "everything", so a caller can pass an absent query
// parameter straight through.
func Filter(claims []domain.Claim, status domain.ClaimStatus, now time.Time) []domain.Claim {
	if status == "" {
		return claims
	}
	out := make([]domain.Claim, 0, len(claims))
	for _, c := range claims {
		if StatusAt(c, now) == status {
			out = append(out, c)
		}
	}
	return out
}
