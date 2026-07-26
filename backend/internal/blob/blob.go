// Package blob defines the object-storage interface the app stores uploaded
// images through, plus the pure rules about what may be uploaded.
//
// It is deliberately the same shape as `storage.Store`: a narrow interface in
// its own package with exactly one implementation today (localfs), so adding S3
// later means writing a sibling package and changing one line in cmd/server —
// nothing that calls this has to know. That pattern is what made "DynamoDB
// adapter" a drop-in for the database, and it is worth having before the first
// file is written rather than after a few hundred are.
package blob

import (
	"context"
	"io"
	"net/http"
)

// Store holds uploaded objects, addressed by a name this package mints.
type Store interface {
	// Put writes an object. contentType is passed through for backends that
	// store it as metadata (S3); localfs ignores it because the minted name
	// already carries the extension.
	Put(ctx context.Context, name, contentType string, r io.Reader) error

	// URL returns where a browser can fetch the object.
	//
	// It MUST be absolute. The frontends are built with an absolute API base
	// URL baked in (see scripts/serve-prod.sh), so they run on a different
	// origin and port from the API: a relative "/uploads/x.png" would resolve
	// against the player app's origin and 404 for every device on the tailnet
	// except the one that happened to be serving both.
	URL(name string) string

	// Delete removes an object. Missing objects are not an error — a caller
	// clearing an image should not have to care whether it was already gone.
	Delete(ctx context.Context, name string) error
}

// HTTPServed is implemented by backends that serve their own bytes over HTTP,
// which localfs does and S3 would not (its URLs point at S3 directly). The API
// mounts Handler() when the configured store offers it, so the serving route
// exists only when something is actually behind it.
type HTTPServed interface {
	// Handler serves objects under URLPrefix.
	Handler() http.Handler
}

// URLPrefix is the path objects are served under, for backends that serve them.
const URLPrefix = "/uploads/"
