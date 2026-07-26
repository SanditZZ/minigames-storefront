package localfs

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/sanditzz/minigames-storefront/backend/internal/blob"
)

func newStore(t *testing.T) *Store {
	t.Helper()
	s, err := Open(t.TempDir(), "http://10.0.0.5:8081/")
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	return s
}

func TestPutThenServe(t *testing.T) {
	s := newStore(t)
	name := blob.NewObjectName(".png")

	if err := s.Put(context.Background(), name, "image/png", strings.NewReader("pretend-png")); err != nil {
		t.Fatalf("Put: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, blob.URLPrefix+name, nil)
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if rec.Body.String() != "pretend-png" {
		t.Errorf("body = %q, want the stored bytes", rec.Body.String())
	}
	if got := rec.Header().Get("X-Content-Type-Options"); got != "nosniff" {
		t.Errorf("X-Content-Type-Options = %q, want nosniff", got)
	}
	if !strings.Contains(rec.Header().Get("Cache-Control"), "immutable") {
		t.Errorf("Cache-Control = %q, want an immutable cache", rec.Header().Get("Cache-Control"))
	}
}

// The trap the roadmap named: the frontends are built with an absolute API URL
// baked in, so a relative object URL resolves against the PLAYER app's origin
// and 404s for every device on the tailnet.
func TestURLIsAbsolute(t *testing.T) {
	s := newStore(t)
	got := s.URL("abcdefghijk.png")

	if !strings.HasPrefix(got, "http://") {
		t.Fatalf("URL = %q, want an absolute URL", got)
	}
	if got != "http://10.0.0.5:8081/uploads/abcdefghijk.png" {
		t.Errorf("URL = %q, want the public base with no doubled slash", got)
	}
}

func TestServeRejectsTraversalRatherThanCleaningIt(t *testing.T) {
	s := newStore(t)
	// A real file one level up, which a naive join would happily serve.
	outside := filepath.Join(filepath.Dir(s.root), "secret.png")
	if err := os.WriteFile(outside, []byte("secret"), 0o600); err != nil {
		t.Fatalf("setup: %v", err)
	}

	for _, path := range []string{
		blob.URLPrefix + "../secret.png",
		blob.URLPrefix + "..%2fsecret.png",
		blob.URLPrefix + "subdir/x.png",
		blob.URLPrefix,
	} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		rec := httptest.NewRecorder()
		s.Handler().ServeHTTP(rec, req)

		if rec.Code != http.StatusNotFound {
			t.Errorf("GET %s: status = %d, want 404", path, rec.Code)
		}
		if strings.Contains(rec.Body.String(), "secret") {
			t.Errorf("GET %s: served a file outside the upload root", path)
		}
	}
}

func TestPutRejectsANameItCouldNotHaveMinted(t *testing.T) {
	s := newStore(t)
	err := s.Put(context.Background(), "../escape.png", "image/png", strings.NewReader("x"))
	if err == nil {
		t.Fatal("Put accepted an unsafe name")
	}
}

// A caller clearing an image should not have to know whether it was there.
func TestDeleteIsIdempotent(t *testing.T) {
	s := newStore(t)
	name := blob.NewObjectName(".png")
	ctx := context.Background()

	if err := s.Put(ctx, name, "image/png", strings.NewReader("x")); err != nil {
		t.Fatalf("Put: %v", err)
	}
	if err := s.Delete(ctx, name); err != nil {
		t.Fatalf("first Delete: %v", err)
	}
	if err := s.Delete(ctx, name); err != nil {
		t.Errorf("second Delete: %v, want nil for a missing object", err)
	}
}

// A failed copy must not leave a half-written image that something later
// serves, so Put stages to a temp file and renames.
func TestPutLeavesNoPartialFileBehind(t *testing.T) {
	s := newStore(t)
	name := blob.NewObjectName(".png")

	err := s.Put(context.Background(), name, "image/png", failingReader{})
	if err == nil {
		t.Fatal("Put succeeded on a failing reader")
	}
	if _, err := os.Stat(filepath.Join(s.root, name)); !os.IsNotExist(err) {
		t.Error("a partial object was left in place")
	}
	entries, _ := os.ReadDir(s.root)
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), ".upload-") {
			t.Errorf("temp file %q was not cleaned up", e.Name())
		}
	}
}

type failingReader struct{}

func (failingReader) Read([]byte) (int, error) { return 0, os.ErrClosed }
