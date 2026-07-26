package settings

import "testing"

func TestIsHexColorAcceptsBothLiteralForms(t *testing.T) {
	for _, ok := range []string{"#abc", "#ABC", "#a1b2c3", "#FF9A86", "#000000"} {
		if !IsHexColor(ok) {
			t.Errorf("IsHexColor(%q) = false, want true", ok)
		}
	}
}

// Each of these is valid CSS a browser would apply. They are rejected because
// the value reaches a live custom property on the player's document — see the
// note on IsHexColor.
func TestIsHexColorRejectsEverythingElseCSSWouldAccept(t *testing.T) {
	bad := map[string]string{
		"red":                    "named colours are CSS, and the allowlist is the point",
		"rgb(255,0,0)":           "function syntax opens the door to url() next to it",
		"var(--color-ink)":       "indirection into whatever else is on the document",
		"url(https://x/y.png)":   "a request to a third party from every player's browser",
		"#fff;background:url(x)": "declaration injection",
		"#ff9a8680":              "8-digit alpha: a translucent base compounds under text-ink/70",
		"#ff9a":                  "4-digit alpha, same reason",
		"#12345":                 "wrong length",
		"#gggggg":                "not hex",
		"ff9a86":                 "missing the leading #",
		" #ff9a86":               "untrimmed — the caller stores exactly what it validates",
		"":                       "empty is a cleared setting, which is a delete not a write",
		"expression(alert(1))":   "legacy IE css expression",
		"#ff9a86 !important":     "modifier smuggled past the value",
	}
	for value, why := range bad {
		if IsHexColor(value) {
			t.Errorf("IsHexColor(%q) = true, want false: %s", value, why)
		}
	}
}
