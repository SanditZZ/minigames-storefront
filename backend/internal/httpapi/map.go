package httpapi

import (
	"net/http"
	"time"

	"github.com/sanditzz/minigames-storefront/backend/internal/app"
	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
	"github.com/sanditzz/minigames-storefront/backend/internal/i18n"
)

// timeFormat is the wire format for timestamps the API emits/accepts.
const timeFormat = time.RFC3339

// localeOf reads the language to answer a request in. The precedence rule lives
// in i18n.Negotiate; this is only the part that knows where the two inputs are
// kept on an HTTP request.
//
// Both inputs are read on every request rather than once per session, because
// there is no session: a kiosk can be re-pinned by editing the URL, and the
// next request has to answer in the new language without anything being
// invalidated.
func localeOf(r *http.Request) i18n.Locale {
	return i18n.Negotiate(r.URL.Query().Get(i18n.LangParam), r.Header.Get("Accept-Language"))
}

// toSubmitInput maps a decoded HTTP request onto the app-layer input type,
// keeping transport DTOs and service types decoupled.
func toSubmitInput(slug domain.GameSlug, req submitScoreRequest) app.SubmitInput {
	return app.SubmitInput{
		GameSlug:   slug,
		Token:      req.Token,
		PlayerName: req.PlayerName,
		Value:      req.Value,
		Events:     req.Events,
	}
}
