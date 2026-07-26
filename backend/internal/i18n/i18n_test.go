package i18n

import "testing"

func TestParse(t *testing.T) {
	cases := []struct {
		raw   string
		want  Locale
		match bool
	}{
		{"th", Thai, true},
		{"TH", Thai, true},
		{"  en  ", English, true},
		// One Thai translation, not one per region.
		{"th-TH", Thai, true},
		{"th_TH", Thai, true},
		{"en-GB", English, true},
		// Unsupported and malformed both report no match, so the caller can
		// fall through to the next source rather than pinning a language
		// nobody wrote strings for.
		{"de", Default, false},
		{"", Default, false},
		{"-", Default, false},
	}
	for _, c := range cases {
		got, ok := Parse(c.raw)
		if got != c.want || ok != c.match {
			t.Errorf("Parse(%q) = (%q, %v), want (%q, %v)", c.raw, got, ok, c.want, c.match)
		}
	}
}

func TestFromAcceptLanguage(t *testing.T) {
	cases := []struct {
		header string
		want   Locale
		match  bool
	}{
		// What a Thai phone actually sends.
		{"th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7", Thai, true},
		{"en-GB,en;q=0.9", English, true},
		// The first SUPPORTED entry wins, not the first entry.
		{"de-DE,fr;q=0.9,th;q=0.8", Thai, true},
		{"de,fr", Default, false},
		{"", Default, false},
	}
	for _, c := range cases {
		got, ok := FromAcceptLanguage(c.header)
		if got != c.want || ok != c.match {
			t.Errorf("FromAcceptLanguage(%q) = (%q, %v), want (%q, %v)", c.header, got, ok, c.want, c.match)
		}
	}
}

// The precedence rule is the whole point of the package, and the case that
// decides it is a till-side phone: an English OS serving Thai customers has to
// be pinnable by URL without anyone touching the phone's settings.
func TestNegotiate(t *testing.T) {
	if got := Negotiate("th", "en-GB,en;q=0.9"); got != Thai {
		t.Errorf("an explicit ?lang= must beat the device, got %q", got)
	}
	if got := Negotiate("en", "th-TH,th;q=0.9"); got != English {
		t.Errorf("an explicit ?lang= must beat the device, got %q", got)
	}
	if got := Negotiate("", "th-TH,th;q=0.9"); got != Thai {
		t.Errorf("the device decides when nothing is pinned, got %q", got)
	}
	// An unrecognised pin is not a pin: it falls through rather than forcing
	// the default onto a device we could have served properly.
	if got := Negotiate("de", "th-TH"); got != Thai {
		t.Errorf("an unknown ?lang= must fall through to the device, got %q", got)
	}
	if got := Negotiate("", ""); got != Default {
		t.Errorf("Negotiate with nothing to go on = %q, want %q", got, Default)
	}
}

// English is the reference column and the fallback, so a gap in it is a message
// that renders as its own id in every language.
func TestEnglishIsComplete(t *testing.T) {
	for _, id := range []MessageID{
		MsgNotFound, MsgGameNotFound, MsgGameUnavailable, MsgInvalidSession,
		MsgSessionExpired, MsgSessionConsumed, MsgScoreRejected, MsgClaimNotFound,
		MsgConflict, MsgInternalError, MsgInvalidBody, MsgTokenRequired,
	} {
		if messages[English][id] == "" {
			t.Errorf("no English text for %q", id)
		}
	}
}

// Every supported locale must cover every English id. A message added without
// its translation would otherwise reach a Thai storefront in English, which is
// exactly the failure this package exists to prevent.
func TestEveryLocaleCoversEnglish(t *testing.T) {
	for _, loc := range Supported {
		if loc == English {
			continue
		}
		for id, english := range messages[English] {
			text, ok := messages[loc][id]
			if !ok || text == "" {
				t.Errorf("locale %q has no text for %q", loc, id)
				continue
			}
			if text == english {
				t.Errorf("locale %q left %q untranslated (%q)", loc, id, text)
			}
		}
	}
}

func TestMessage(t *testing.T) {
	if got := Message(MsgGameNotFound, Thai); got != messages[Thai][MsgGameNotFound] {
		t.Errorf("Message returned %q for Thai", got)
	}
	// A locale with no table at all still reads, in English.
	if got := Message(MsgGameNotFound, Locale("de")); got != messages[English][MsgGameNotFound] {
		t.Errorf("unknown locale should fall back to English, got %q", got)
	}
	// An id nobody wrote surfaces AS the id: visibly wrong in a screenshot
	// rather than an invisible gap in a sentence.
	if got := Message(MessageID("error.nothing"), Thai); got != "error.nothing" {
		t.Errorf("unknown id should fall back to itself, got %q", got)
	}
}
