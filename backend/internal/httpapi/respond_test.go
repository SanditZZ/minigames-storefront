package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestMatchesETag(t *testing.T) {
	const tag = `"abc123"`
	cases := []struct {
		name   string
		header string
		want   bool
	}{
		{"absent", "", false},
		{"exact", `"abc123"`, true},
		{"different", `"def456"`, false},
		// A cache that revalidated through a proxy may mark the same tag weak.
		// Weak comparison is the right one for a conditional GET.
		{"weak form of the same tag", `W/"abc123"`, true},
		{"one of a list", `"zzz", W/"abc123", "yyy"`, true},
		{"list with no match", `"zzz", "yyy"`, false},
		{"wildcard", "*", true},
		// The quotes are part of the tag, so an unquoted value is not it.
		{"unquoted", "abc123", false},
	}
	for _, c := range cases {
		if got := matchesETag(c.header, tag); got != c.want {
			t.Errorf("%s: matchesETag(%q) = %v, want %v", c.name, c.header, got, c.want)
		}
	}
}

func TestWriteJSONRevalidatedServesTheBodyWithATag(t *testing.T) {
	rec := httptest.NewRecorder()
	writeJSONRevalidated(rec, httptest.NewRequest(http.MethodGet, "/x", nil),
		map[string]string{"store_name": "Fun Store"})

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if rec.Header().Get("ETag") == "" {
		t.Fatal("no ETag, so the client has nothing to revalidate with")
	}
	// no-cache, never no-store: the copy is kept and re-checked every time, which
	// is what stops an operator's edit from being invisible.
	if got := rec.Header().Get("Cache-Control"); got != "no-cache" {
		t.Fatalf("Cache-Control = %q, want no-cache", got)
	}
	if rec.Body.Len() == 0 {
		t.Fatal("a 200 must carry the body")
	}
}

func TestWriteJSONRevalidatedSkipsTheBodyForAKnownTag(t *testing.T) {
	body := map[string]string{"store_name": "Fun Store"}

	first := httptest.NewRecorder()
	writeJSONRevalidated(first, httptest.NewRequest(http.MethodGet, "/x", nil), body)
	tag := first.Header().Get("ETag")

	repeat := httptest.NewRequest(http.MethodGet, "/x", nil)
	repeat.Header.Set("If-None-Match", tag)
	second := httptest.NewRecorder()
	writeJSONRevalidated(second, repeat, body)

	if second.Code != http.StatusNotModified {
		t.Fatalf("status = %d, want 304 for a tag the client already holds", second.Code)
	}
	if second.Body.Len() != 0 {
		t.Fatalf("304 carried %d bytes; the saving IS the empty body", second.Body.Len())
	}
	if second.Header().Get("ETag") != tag {
		t.Fatal("a 304 must still name the tag it is confirming")
	}
}

// The tag is a hash of the response, so anything that changes the response —
// an operator's edit, a different locale — changes it without this code being
// told what varies.
func TestWriteJSONRevalidatedRetagsAChangedBody(t *testing.T) {
	before := httptest.NewRecorder()
	writeJSONRevalidated(before, httptest.NewRequest(http.MethodGet, "/x", nil),
		map[string]string{"store_name": "Fun Store"})

	stale := httptest.NewRequest(http.MethodGet, "/x", nil)
	stale.Header.Set("If-None-Match", before.Header().Get("ETag"))
	after := httptest.NewRecorder()
	writeJSONRevalidated(after, stale, map[string]string{"store_name": "Renamed Store"})

	if after.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 — the body changed under the client's tag", after.Code)
	}
	if after.Header().Get("ETag") == before.Header().Get("ETag") {
		t.Fatal("a changed body kept its old tag, so the rename would never be seen")
	}
}
