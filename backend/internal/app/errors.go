package app

import "errors"

// Domain-level errors the transport layer maps to HTTP status codes. Keeping
// them here (not as raw strings) lets handlers switch on identity, not text.
var (
	ErrGameUnavailable = errors.New("game unavailable")
	ErrInvalidSession  = errors.New("invalid session")
	ErrSessionExpired  = errors.New("session expired")
	ErrSessionConsumed = errors.New("session already used")
	ErrScoreRejected   = errors.New("score rejected")

	// ErrClaimNotFound covers both a code that does not exist and one that
	// could not exist (wrong length, a character outside the alphabet). They
	// are deliberately the same answer: distinguishing them would tell someone
	// guessing codes which of their guesses were the right SHAPE.
	ErrClaimNotFound = errors.New("claim not found")
	// ErrClaimNotRedeemable is a real claim that cannot be handed over now —
	// already redeemed, or expired. Wrapped with the reason from
	// claim.CanRedeem, so the admin at the counter is told which.
	ErrClaimNotRedeemable = errors.New("claim not redeemable")
	// ErrClaimNotUnredeemable is a real claim whose redemption cannot be taken
	// back, which today means only one thing: it was never redeemed. It is a
	// separate error from ErrClaimNotRedeemable rather than a reuse of it because
	// the two mean opposite things about the same claim — "not redeemable"
	// usually means it is ALREADY redeemed, which is precisely the state in which
	// un-redeeming is legal. One error covering both would make the message an
	// admin reads at the counter a puzzle.
	ErrClaimNotUnredeemable = errors.New("claim not unredeemable")
)
