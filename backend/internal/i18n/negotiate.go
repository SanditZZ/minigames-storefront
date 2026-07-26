package i18n

import "strings"

// LangParam is the query-string key a client uses to ask for a language.
//
// It matches the player app's own `?lang=` URL parameter (see
// packages/player-core/src/router), which is deliberate: the locale is
// addressable on both sides of the wire, so a kiosk pinned to Thai by URL sends
// requests pinned to Thai too, and a link pasted to a colleague carries the
// language with it.
const LangParam = "lang"

// Parse maps a raw language tag onto a supported Locale, reporting whether it
// matched. Case and region are ignored: "TH", "th", "th-TH" and "th_TH" are all
// Thai, because a tag arrives from a browser setting or a hand-typed URL and
// neither is a place to be strict about casing.
//
// Pure: no defaulting happens here. A caller that wants a Locale regardless
// uses Negotiate, which is the one place the fallback rule lives.
func Parse(raw string) (Locale, bool) {
	tag := strings.TrimSpace(strings.ToLower(raw))
	if tag == "" {
		return Default, false
	}
	// A tag is language[-region]; only the language subtag identifies a locale
	// here, since there is one Thai and one English translation rather than
	// per-region variants.
	if i := strings.IndexAny(tag, "-_"); i > 0 {
		tag = tag[:i]
	}
	if l := Locale(tag); IsSupported(l) {
		return l, true
	}
	return Default, false
}

// FromAcceptLanguage picks the first supported locale out of an Accept-Language
// header, reporting whether anything matched.
//
// Entries are taken in the order they appear rather than re-sorted by q-value.
// Browsers emit their list in preference order already ("th-TH,th;q=0.9,
// en-US;q=0.8"), so ordering by q would agree with list order in every case
// this actually sees, while adding a float parser to a pure function whose
// worst failure mode is answering in the user's second language.
func FromAcceptLanguage(header string) (Locale, bool) {
	for _, entry := range strings.Split(header, ",") {
		// Drop the ";q=…" weight; the tag is everything before it.
		if i := strings.IndexByte(entry, ';'); i >= 0 {
			entry = entry[:i]
		}
		if l, ok := Parse(entry); ok {
			return l, true
		}
	}
	return Default, false
}

// Negotiate resolves the locale to answer a request in, and is the ONLY place
// the precedence rule lives:
//
//	?lang=  →  Accept-Language  →  Default
//
// An explicit parameter beats the device because it is the one a person chose:
// a till-side phone whose OS is in English still has to be pinnable to Thai for
// the customers standing in front of it, and a link that carries `?lang=th`
// has to keep meaning Thai on whatever phone opens it.
func Negotiate(param, acceptLanguage string) Locale {
	if l, ok := Parse(param); ok {
		return l
	}
	if l, ok := FromAcceptLanguage(acceptLanguage); ok {
		return l
	}
	return Default
}
