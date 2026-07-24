package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/sanditzz/minigames-storefront/backend/internal/app"
	"github.com/sanditzz/minigames-storefront/backend/internal/storage"
)

// writeJSON is the single place responses are serialized, so every handler is
// consistent about content-type and encoding.
func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if body == nil {
		return
	}
	_ = json.NewEncoder(w).Encode(body)
}

// errorBody is the uniform error envelope the frontends can rely on.
type errorBody struct {
	Error string `json:"error"`
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, errorBody{Error: msg})
}

// writeAppError maps domain/storage errors to HTTP status codes in one place,
// keeping handlers free of status-code bookkeeping.
func writeAppError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, storage.ErrNotFound):
		writeError(w, http.StatusNotFound, "not found")
	case errors.Is(err, app.ErrGameUnavailable):
		writeError(w, http.StatusNotFound, "game unavailable")
	case errors.Is(err, app.ErrInvalidSession):
		writeError(w, http.StatusBadRequest, "invalid session")
	case errors.Is(err, app.ErrSessionExpired):
		writeError(w, http.StatusGone, "session expired")
	case errors.Is(err, app.ErrSessionConsumed):
		writeError(w, http.StatusConflict, "session already used")
	case errors.Is(err, app.ErrScoreRejected):
		writeError(w, http.StatusUnprocessableEntity, err.Error())
	case errors.Is(err, storage.ErrConflict):
		writeError(w, http.StatusConflict, "conflict")
	default:
		writeError(w, http.StatusInternalServerError, "internal error")
	}
}

// decodeJSON reads a JSON request body into dst, rejecting unknown fields so
// typos in client payloads surface as 400s instead of silent no-ops.
func decodeJSON(r *http.Request, dst any) error {
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	return dec.Decode(dst)
}
