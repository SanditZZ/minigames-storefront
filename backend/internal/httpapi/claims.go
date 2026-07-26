package httpapi

import (
	"net/http"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
)

// handleListClaims serves the counter's worklist: every claim, newest first,
// optionally narrowed with ?status=issued|redeemed|expired.
//
// The filter is applied by the service (over the rows) rather than by the
// database, because status is derived — see storage.ClaimRepository. An
// unrecognised status is rejected rather than quietly treated as "all": an
// admin who mistypes ?status=redeeemed must not be shown every claim and left
// to assume they are all redeemed.
func (s *Server) handleListClaims(w http.ResponseWriter, r *http.Request) {
	status := domain.ClaimStatus(r.URL.Query().Get("status"))
	switch status {
	case "", domain.ClaimIssued, domain.ClaimRedeemed, domain.ClaimExpired:
	default:
		writeError(w, http.StatusBadRequest, "unknown status filter")
		return
	}

	claims, err := s.svc.ListClaims(r.Context(), status)
	if err != nil {
		writeAppError(w, localeOf(r), err)
		return
	}
	writeJSON(w, http.StatusOK, claims)
}

// handleRedeemClaim marks a prize handed over.
//
// The code is a path parameter rather than a body field because this is the
// address of a thing being acted on, and it keeps the admin app's request as
// simple as the counter's workflow: read the code, POST it. Normalization
// (case, the grouping dash) happens in the service, so a code typed exactly as
// it is displayed works without the client having to strip anything.
func (s *Server) handleRedeemClaim(w http.ResponseWriter, r *http.Request) {
	view, err := s.svc.RedeemClaim(r.Context(), r.PathValue("code"))
	if err != nil {
		writeAppError(w, localeOf(r), err)
		return
	}
	writeJSON(w, http.StatusOK, view)
}
