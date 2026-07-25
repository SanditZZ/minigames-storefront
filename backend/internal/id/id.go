// Package id mints the identifiers for persisted entities.
//
// It is an ACTION (it draws from crypto/rand, so it is not pure) but a
// deliberately tiny one, kept in its own package so that every entity id in the
// system comes from a single line of code. Changing the length or the alphabet
// is then one edit, not a search for scattered generator calls.
//
// Scope: entity ids only — scores and awards. Session tokens are NOT minted
// here; see TokenLengthNote below.
package id

import (
	"strings"

	gonanoid "github.com/matoous/go-nanoid/v2"
)

// Length is the character count of every entity id. Eleven characters of the
// default nanoid alphabet (64 symbols) carry 66 bits of entropy, which keeps a
// score id unguessable in a public URL while staying short enough to read out,
// type, or fit on a printed receipt.
const Length = 11

// Alphabet is nanoid's default: URL-safe, so an id needs no escaping in a path.
const Alphabet = "_-0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

// TokenLengthNote records why session tokens are deliberately not minted here.
//
// A session token is a credential — an unguessable single-use permit to submit
// a score — rather than a name for something. It is never shown, typed, or put
// in a URL, so shortening it buys nothing and would trade away entropy on the
// only secret the play flow has. Tokens stay UUIDv4 (122 bits).
const TokenLengthNote = "session tokens are credentials, not identifiers: they stay UUIDv4"

// --- Claim codes: a third format, deliberately -----------------------------
//
// The repo rule is "never introduce a second id format", and the point of that
// rule is that every format decision lives in this package — so a third one
// belongs here, reasoned, rather than inlined at a call site. Following the
// precedent of TokenLengthNote: make the exception explicit.
//
// A claim code is neither an entity id nor a credential in the session sense.
// It is READ ALOUD AND TYPED BY A HUMAN at a counter, off a phone screen, in
// bad light. That single property rules out both existing formats: nanoid's
// alphabet is case-sensitive and contains every confusable pair there is, and a
// 36-character UUID is hopeless to transcribe.

// ClaimCodeLength is the character count of a claim code. Eight characters of
// the 31-symbol alphabet carry ~39 bits — far less than an entity id, and
// deliberately so. A code is only useful to someone who also reaches the
// counter, its collisions are caught by a UNIQUE constraint, and every extra
// character is one more chance to mistype.
const ClaimCodeLength = 8

// ClaimCodeAlphabet is uppercase and CONFUSABLE-FREE: no 0/O, no 1/I/L.
//
// Note that BOTH members of each confusable pair are absent, not one of them.
// That is what makes transcription unambiguous in the useful direction: a code
// can never contain a character that looks like another legal character, so
// "did they write O or 0?" is not a question anyone has to answer — an O simply
// is not a valid code character, and the input is a typo rather than a
// different valid code. It also means normalization needs no lookalike mapping.
const ClaimCodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

// NewClaimCode returns a fresh claim code.
//
// Uniqueness is NOT assumed from the entropy: the caller writes it behind a
// UNIQUE constraint and retries on conflict. 39 bits is a convenience, not a
// guarantee.
func NewClaimCode() string {
	return gonanoid.MustGenerate(ClaimCodeAlphabet, ClaimCodeLength)
}

// NormalizeClaimCode puts human-typed input into the canonical form.
//
// Pure. It uppercases and drops the separators a person naturally adds (spaces
// and the dashes the player app groups the code with, "ABCD-2345"). It does NOT
// drop unknown characters: silently deleting a mistyped "O" would turn a typo
// into a shorter string that fails validation for the wrong reason, or worse,
// into a different valid code. Anything left over is judged by LooksLikeClaimCode.
func NormalizeClaimCode(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		switch r {
		case ' ', '-', '\t':
			continue
		}
		if r >= 'a' && r <= 'z' {
			r -= 'a' - 'A'
		}
		b.WriteRune(r)
	}
	return b.String()
}

// LooksLikeClaimCode reports whether s is already in the shape NewClaimCode
// mints. Pure, and the counterpart to NormalizeClaimCode: normalize first, then
// check, so a handler can reject junk before it ever reaches the database.
func LooksLikeClaimCode(s string) bool {
	if len(s) != ClaimCodeLength {
		return false
	}
	for _, r := range s {
		if !strings.ContainsRune(ClaimCodeAlphabet, r) {
			return false
		}
	}
	return true
}

// New returns a fresh entity id.
//
// It panics only if the system CSPRNG fails, which is not a condition a caller
// can meaningfully recover from — an id that is not random is worse than a
// crash, because it is silently guessable.
func New() string {
	return gonanoid.Must(Length)
}

// Looks reports whether s has the shape of an id this package mints.
//
// Pure, and the counterpart to New: the migration uses it to tell an
// already-converted row from one still holding a UUID, which is what makes
// re-running the migration a no-op instead of a second rewrite.
func Looks(s string) bool {
	if len(s) != Length {
		return false
	}
	for _, r := range s {
		if !isAlphabet(r) {
			return false
		}
	}
	return true
}

func isAlphabet(r rune) bool {
	for _, a := range Alphabet {
		if r == a {
			return true
		}
	}
	return false
}
