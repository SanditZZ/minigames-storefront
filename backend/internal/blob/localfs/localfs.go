// Package localfs stores uploaded objects as files on disk and serves them over
// HTTP. It is the only blob.Store implementation today; an S3 one is a sibling
// package away, because nothing outside this file knows where bytes live.
package localfs

import (
	"context"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/sanditzz/minigames-storefront/backend/internal/blob"
)

// Store writes objects under Root and serves them under blob.URLPrefix.
type Store struct {
	root      string
	publicURL string // absolute base, e.g. http://100.x.x.x:8081
}

// Open prepares the directory and returns a store.
//
// publicURL must be the absolute base the API is reached at — NOT a path. The
// frontends are built with an absolute API URL baked in and run on their own
// origin, so a relative object URL would resolve against the player app and
// 404. See blob.Store.URL.
func Open(root, publicURL string) (*Store, error) {
	abs, err := filepath.Abs(root)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(abs, 0o755); err != nil {
		return nil, err
	}
	return &Store{root: abs, publicURL: strings.TrimRight(publicURL, "/")}, nil
}

// Put writes the object, replacing any file already under that name.
//
// It writes to a temporary file in the same directory and renames it into
// place, so a failed or truncated upload never becomes a half-written image
// that something later serves. contentType is unused: the minted name already
// carries the extension, and an S3 implementation is where it becomes metadata.
func (s *Store) Put(ctx context.Context, name, contentType string, r io.Reader) error {
	path, err := s.pathFor(name)
	if err != nil {
		return err
	}

	tmp, err := os.CreateTemp(s.root, ".upload-*")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name()) // no-op once the rename succeeds

	if _, err := io.Copy(tmp, r); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), path)
}

// URL returns the absolute address the object is served at.
func (s *Store) URL(name string) string {
	return s.publicURL + blob.URLPrefix + name
}

// Delete removes an object. A name that does not exist is not an error.
func (s *Store) Delete(ctx context.Context, name string) error {
	path, err := s.pathFor(name)
	if err != nil {
		return err
	}
	if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return nil
}

// ErrBadName is returned for a name this package could not have minted.
var ErrBadName = errors.New("localfs: unsafe object name")

// pathFor is the ONLY place a name becomes a filesystem path, so the shape
// check cannot be bypassed by a second caller. Names are minted by
// blob.NewObjectName, so this rejecting anything means a bug, not a request.
func (s *Store) pathFor(name string) (string, error) {
	if !blob.IsSafeObjectName(name) {
		return "", ErrBadName
	}
	return filepath.Join(s.root, name), nil
}

// Handler serves the stored objects.
//
// It does NOT use http.FileServer, which would also list directories, follow
// index.html, and resolve any path the URL contains. Serving one validated name
// per request is both simpler and the whole traversal defence: a request for
// `/uploads/../../etc/passwd` fails the name check rather than being cleaned
// into something that might still escape.
func (s *Store) Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(r.URL.Path, blob.URLPrefix)
		path, err := s.pathFor(name)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		f, err := os.Open(path)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		defer f.Close()

		info, err := f.Stat()
		if err != nil || info.IsDir() {
			http.NotFound(w, r)
			return
		}

		// Uploaded images are immutable — a replacement gets a new name — so
		// they can be cached hard. This is the one response in the API worth
		// caching at all, and the reason a re-upload mints a fresh id rather
		// than overwriting.
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		// Belt and braces against a stored file being interpreted as anything
		// executable: the name check already limits this to raster extensions.
		w.Header().Set("X-Content-Type-Options", "nosniff")
		http.ServeContent(w, r, name, info.ModTime(), f)
	})
}

// Compile-time proof this satisfies both interfaces.
var (
	_ blob.Store      = (*Store)(nil)
	_ blob.HTTPServed = (*Store)(nil)
)
