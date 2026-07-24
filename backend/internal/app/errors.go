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
)
