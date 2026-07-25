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
