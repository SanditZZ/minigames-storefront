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
)
