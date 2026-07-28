// Package httpapi is the ACTION/transport layer: it parses HTTP requests,
// delegates to the app service, and marshals responses. It holds no business
// rules — every decision of consequence lives in app/game/reward.
package httpapi

import (
	"crypto/subtle"
	"log"
	"net/http"
	"strings"

	"github.com/sanditzz/minigames-storefront/backend/internal/app"
	"github.com/sanditzz/minigames-storefront/backend/internal/blob"
)

// Server binds the app service to an HTTP router.
type Server struct {
	svc        *app.Service
	cors       []string
	adminToken string
	blobs      blob.Store // nil disables the upload routes
	handler    http.Handler
}

// NewServer builds the router with all routes and middleware wired. adminToken
// guards the /api/v1/admin/* routes; an empty token leaves them open (dev only).
//
// blobs may be nil, which disables uploads rather than crashing — the API is
// still fully usable with image URLs typed by hand, which is what it did before
// object storage existed.
func NewServer(svc *app.Service, corsOrigins []string, adminToken string, blobs blob.Store) *Server {
	if adminToken == "" {
		log.Print("WARNING: admin API is unauthenticated (APP_ADMIN_TOKEN is empty)")
	}
	s := &Server{svc: svc, cors: corsOrigins, adminToken: adminToken, blobs: blobs}
	s.handler = chain(s.routes(),
		recoverMiddleware,
		logMiddleware,
		corsMiddleware(corsOrigins),
	)
	return s
}

// requireAdmin wraps an admin handler with a constant-time shared-secret check.
// The secret may arrive as "Authorization: Bearer <token>" or "X-Admin-Token".
// A constant-time compare avoids leaking the token via response timing.
func (s *Server) requireAdmin(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if s.adminToken == "" {
			h(w, r) // dev mode: no gate
			return
		}
		presented := r.Header.Get("X-Admin-Token")
		if presented == "" {
			presented = strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		}
		if subtle.ConstantTimeCompare([]byte(presented), []byte(s.adminToken)) != 1 {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		h(w, r)
	}
}

// Handler exposes the fully-decorated handler for http.Server / tests.
func (s *Server) Handler() http.Handler { return s.handler }

func (s *Server) routes() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	// --- Player-facing play flow ---
	mux.HandleFunc("GET /api/v1/games", s.handleListGames)
	mux.HandleFunc("GET /api/v1/games/{slug}", s.handleGetGame)
	mux.HandleFunc("POST /api/v1/games/{slug}/sessions", s.handleStartSession)
	mux.HandleFunc("POST /api/v1/games/{slug}/scores", s.handleSubmitScore)
	mux.HandleFunc("GET /api/v1/games/{slug}/scores", s.handleHighScores)
	mux.HandleFunc("GET /api/v1/games/{slug}/scores/{id}", s.handleGetScore)
	mux.HandleFunc("GET /api/v1/games/{slug}/awards", s.handlePrizes)

	// The whole catalog's prizes in one read, for the landing screen. Public for
	// the same reason the per-game route is — it is advertising — and it lives
	// outside /games/{slug} because it is not about one game. Never fold the
	// per-game route into this by making {slug} optional: the two answer
	// different questions and only one of them is on the first-paint path.
	mux.HandleFunc("GET /api/v1/awards", s.handleAllPrizes)

	// The storefront's identity (name, tagline) is player-facing, so it is the
	// one settings read that is NOT behind requireAdmin. settings.Public is the
	// allowlist that keeps it to that — never widen this route to the full list.
	mux.HandleFunc("GET /api/v1/settings/public", s.handlePublicSettings)

	// --- Admin CRUD (guarded by the shared-secret header) ---
	mux.HandleFunc("GET /api/v1/admin/awards", s.requireAdmin(s.handleListAwards))
	mux.HandleFunc("POST /api/v1/admin/awards", s.requireAdmin(s.handleCreateAward))
	mux.HandleFunc("GET /api/v1/admin/awards/{id}", s.requireAdmin(s.handleGetAward))
	mux.HandleFunc("PUT /api/v1/admin/awards/{id}", s.requireAdmin(s.handleUpdateAward))
	mux.HandleFunc("DELETE /api/v1/admin/awards/{id}", s.requireAdmin(s.handleDeleteAward))

	// Claims are admin-only: the list is every outstanding prize in the venue,
	// and redeeming is the act of giving one away.
	mux.HandleFunc("GET /api/v1/admin/claims", s.requireAdmin(s.handleListClaims))
	mux.HandleFunc("GET /api/v1/admin/claims/{code}", s.requireAdmin(s.handleGetClaim))
	mux.HandleFunc("POST /api/v1/admin/claims/{code}/redeem", s.requireAdmin(s.handleRedeemClaim))
	mux.HandleFunc("POST /api/v1/admin/claims/{code}/unredeem", s.requireAdmin(s.handleUnredeemClaim))

	// Uploads are admin-only to WRITE and public to READ — an image nobody can
	// fetch is not an image. Serving is mounted only when the configured store
	// serves its own bytes; an S3-backed one would hand out its own URLs and
	// this route would not exist.
	mux.HandleFunc("POST /api/v1/admin/uploads", s.requireAdmin(s.handleUpload))
	mux.HandleFunc("DELETE /api/v1/admin/uploads/{name}", s.requireAdmin(s.handleDeleteUpload))
	if served, ok := s.blobs.(blob.HTTPServed); ok {
		mux.Handle("GET "+blob.URLPrefix, served.Handler())
	}

	mux.HandleFunc("GET /api/v1/admin/settings", s.requireAdmin(s.handleListSettings))
	mux.HandleFunc("PUT /api/v1/admin/settings/{key}", s.requireAdmin(s.handleUpsertSetting))
	mux.HandleFunc("DELETE /api/v1/admin/settings/{key}", s.requireAdmin(s.handleDeleteSetting))

	// The player app needs to know which games exist to render its picker; the
	// admin app additionally needs the game list to target awards. Both are
	// non-sensitive catalog reads already served by GET /api/v1/games.

	return mux
}
