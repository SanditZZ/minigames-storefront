package httpapi

import (
	"time"

	"github.com/sanditzz/minigames-storefront/backend/internal/app"
	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
)

// timeFormat is the wire format for timestamps the API emits/accepts.
const timeFormat = time.RFC3339

// toSubmitInput maps a decoded HTTP request onto the app-layer input type,
// keeping transport DTOs and service types decoupled.
func toSubmitInput(slug domain.GameSlug, req submitScoreRequest) app.SubmitInput {
	return app.SubmitInput{
		GameSlug:   slug,
		Token:      req.Token,
		PlayerName: req.PlayerName,
		Value:      req.Value,
	}
}
