package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/sanditzz/minigames-storefront/backend/internal/app"
	"github.com/sanditzz/minigames-storefront/backend/internal/i18n"
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

// writeError sends a literal English message. It is for failures only an ADMIN
// can provoke — a malformed award payload, an upload of the wrong type, a bad
// token — which the admin app renders untranslated. Anything a player can read
// goes through writeMessage instead.
func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, errorBody{Error: msg})
}

// writeMessage sends a catalog message in the caller's locale. This is the one
// used on the play flow: the player app shows the API's `error` string verbatim
// in a StatusMessage, so an English sentence on a Thai screen is not a rough
// edge, it is the feature failing at the only moment it is visible.
func writeMessage(w http.ResponseWriter, loc i18n.Locale, status int, id i18n.MessageID) {
	writeJSON(w, status, errorBody{Error: i18n.Message(id, loc)})
}

// writeAppError maps domain/storage errors to HTTP status codes in one place,
// keeping handlers free of status-code bookkeeping. The locale comes from the
// request (see localeOf) so the same mapping serves both languages.
func writeAppError(w http.ResponseWriter, loc i18n.Locale, err error) {
	switch {
	case errors.Is(err, storage.ErrNotFound):
		writeMessage(w, loc, http.StatusNotFound, i18n.MsgNotFound)
	case errors.Is(err, app.ErrGameUnavailable):
		writeMessage(w, loc, http.StatusNotFound, i18n.MsgGameUnavailable)
	case errors.Is(err, app.ErrInvalidSession):
		writeMessage(w, loc, http.StatusBadRequest, i18n.MsgInvalidSession)
	case errors.Is(err, app.ErrSessionExpired):
		writeMessage(w, loc, http.StatusGone, i18n.MsgSessionExpired)
	case errors.Is(err, app.ErrSessionConsumed):
		writeMessage(w, loc, http.StatusConflict, i18n.MsgSessionConsumed)
	case errors.Is(err, app.ErrScoreRejected):
		// The wrapped reason is a diagnostic COMPOSED at the point of rejection
		// ("score 900 exceeds plausible maximum 120 for 5000ms"), not a
		// sentence looked up from a table, so there is no Thai equivalent to
		// reach for. English keeps it — it is the only account of a rejection
		// that reaches the wire — and Thai gets the plain sentence rather than
		// an English string wearing a Thai status code. Translating the
		// validators properly is filed in docs/potential-features.md.
		if loc == i18n.English {
			writeError(w, http.StatusUnprocessableEntity, err.Error())
			return
		}
		writeMessage(w, loc, http.StatusUnprocessableEntity, i18n.MsgScoreRejected)
	case errors.Is(err, app.ErrClaimNotFound):
		writeMessage(w, loc, http.StatusNotFound, i18n.MsgClaimNotFound)
	case errors.Is(err, app.ErrClaimNotRedeemable), errors.Is(err, app.ErrClaimNotUnredeemable):
		// The wrapped reason (already redeemed / expired / never redeemed) is the
		// message: it is what the admin at the counter has to tell the person in
		// front of them. Admin-facing, and so untranslated with the rest of that
		// app. Both directions are 409 for the same reason — the request was
		// well-formed and the claim's state is what refused it.
		writeError(w, http.StatusConflict, err.Error())
	case errors.Is(err, storage.ErrConflict):
		writeMessage(w, loc, http.StatusConflict, i18n.MsgConflict)
	default:
		writeMessage(w, loc, http.StatusInternalServerError, i18n.MsgInternalError)
	}
}

// decodeJSON reads a JSON request body into dst, rejecting unknown fields so
// typos in client payloads surface as 400s instead of silent no-ops.
func decodeJSON(r *http.Request, dst any) error {
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	return dec.Decode(dst)
}
