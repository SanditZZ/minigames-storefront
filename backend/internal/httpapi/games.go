package httpapi

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/sanditzz/minigames-storefront/backend/internal/app"
	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
	"github.com/sanditzz/minigames-storefront/backend/internal/game"
	"github.com/sanditzz/minigames-storefront/backend/internal/i18n"
	"github.com/sanditzz/minigames-storefront/backend/internal/reward"
)

func (s *Server) handleListGames(w http.ResponseWriter, r *http.Request) {
	// Only enabled games are offered to players, with any admin-tuned benchmark
	// applied — see app.ListGames for why that layering happens on read.
	//
	// Localizing here rather than in the service is the same layering argument
	// one step further out: which games exist and what they are worth does not
	// depend on who is reading, but what they are CALLED does.
	writeJSON(w, http.StatusOK, game.LocalizeAll(s.svc.ListGames(r.Context()), localeOf(r)))
}

func (s *Server) handleGetGame(w http.ResponseWriter, r *http.Request) {
	loc := localeOf(r)
	g, err := s.svc.GetGame(r.Context(), domain.GameSlug(r.PathValue("slug")))
	if err != nil {
		writeMessage(w, loc, http.StatusNotFound, i18n.MsgGameNotFound)
		return
	}
	writeJSON(w, http.StatusOK, game.Localize(g, loc))
}

// startSessionResponse is what the player app needs to run and time a round.
//
// Challenge is absent for every game the client scores itself, which is most of
// them — hence the pointer and the omitempty. A game that HAS one cannot render
// its round without it: it carries the physics the client must simulate, so
// that the tuning has a single home rather than one copy per simulation. See
// game.Definition.
type startSessionResponse struct {
	Token      string          `json:"token"`
	GameSlug   domain.GameSlug `json:"gameSlug"`
	DurationMs int             `json:"durationMs"`
	ExpiresAt  string          `json:"expiresAt"`
	Challenge  any             `json:"challenge,omitempty"`
}

func (s *Server) handleStartSession(w http.ResponseWriter, r *http.Request) {
	slug := domain.GameSlug(r.PathValue("slug"))
	sess, def, err := s.svc.StartSession(r.Context(), slug)
	if err != nil {
		writeAppError(w, localeOf(r), err)
		return
	}
	// The challenge is echoed from the SESSION, not rebuilt here. It was minted
	// and stored when the session was created precisely so the client and the
	// scorer see the same round — rebuilding it would draw a second, different
	// phase for Precision Stop and score the player against a sweep they never
	// saw. json.RawMessage so the stored text lands as an object rather than as
	// a JSON string containing JSON.
	var challenge any
	if sess.Challenge != "" {
		challenge = json.RawMessage(sess.Challenge)
	}
	writeJSON(w, http.StatusCreated, startSessionResponse{
		Token:      sess.Token,
		GameSlug:   sess.GameSlug,
		DurationMs: def.Game.DurationMs,
		ExpiresAt:  sess.ExpiresAt.Format(timeFormat),
		Challenge:  challenge,
	})
}

// submitScoreRequest is the client payload. Elapsed time is deliberately NOT
// accepted from the client — the server derives it from the session.
//
// Value and Events are alternatives, not a pair. A game the client scores sends
// a value; a game the SERVER scores sends events — the moments the player
// acted — and no value at all, because the number is the server's to compute.
// Sending both is not an error, it is just half wasted: the game's Definition
// decides which field is read and the other is ignored. See app.scoreOf.
type submitScoreRequest struct {
	Token      string `json:"token"`
	PlayerName string `json:"playerName"`
	Value      int    `json:"value"`
	Events     []int  `json:"events,omitempty"`
}

func (s *Server) handleSubmitScore(w http.ResponseWriter, r *http.Request) {
	loc := localeOf(r)
	slug := domain.GameSlug(r.PathValue("slug"))
	var req submitScoreRequest
	if err := decodeJSON(r, &req); err != nil {
		writeMessage(w, loc, http.StatusBadRequest, i18n.MsgInvalidBody)
		return
	}
	if req.Token == "" {
		writeMessage(w, loc, http.StatusBadRequest, i18n.MsgTokenRequired)
		return
	}
	result, err := s.svc.SubmitScore(r.Context(), toSubmitInput(slug, req))
	if err != nil {
		writeAppError(w, loc, err)
		return
	}
	writeJSON(w, http.StatusCreated, localizedResult(result, loc))
}

// handleGetScore serves a single finished round, so the player app's result URL
// survives a reload or being shared. Same response shape as a submission, minus
// the side effects.
func (s *Server) handleGetScore(w http.ResponseWriter, r *http.Request) {
	slug := domain.GameSlug(r.PathValue("slug"))
	loc := localeOf(r)
	result, err := s.svc.ScoreResult(r.Context(), slug, r.PathValue("id"))
	if err != nil {
		writeAppError(w, loc, err)
		return
	}
	writeJSON(w, http.StatusOK, localizedResult(result, loc))
}

// localizedResult words a finished round's prize for the reader.
//
// Both player-facing score endpoints return this shape, so it is done once here
// rather than twice inline — and it is done at the transport edge for the same
// reason game.Localize is: the service decides what was won, and the language it
// is described in depends only on who is asking.
//
// The award and the claim are worded from DIFFERENT sources on purpose. The
// award is the live row, so it follows an operator's later edits; the claim
// carries its own snapshot, so it keeps saying what was won even after the award
// is renamed or deleted. Wording both from the award would quietly undo that.
//
// Copies throughout: SubmitResult holds pointers, and rewriting through them
// would mutate values the service still owns.
func localizedResult(result app.SubmitResult, loc i18n.Locale) app.SubmitResult {
	if result.Award != nil {
		localized := reward.LocalizedAward(*result.Award, loc)
		result.Award = &localized
	}
	if result.Claim != nil {
		view := *result.Claim
		view.Claim = reward.LocalizedClaim(view.Claim, loc)
		result.Claim = &view
	}
	return result
}

// handlePrizes serves the prizes a game is offering, for the landing screen's
// showcase. Public by design — it is advertising — and it returns the trimmed
// reward.PublicAward shape, never raw awards with their stock levels.
func (s *Server) handlePrizes(w http.ResponseWriter, r *http.Request) {
	slug := domain.GameSlug(r.PathValue("slug"))
	// The prizes ARE localized, from awards.name_th / description_th rather than
	// from a message table: a prize name is admin-entered free text, so no table
	// on this side of the wire could hold it. The pick falls back per field and
	// happens inside Showcase — see internal/reward/text.go for why there and
	// not here.
	loc := localeOf(r)
	prizes, err := s.svc.Prizes(r.Context(), slug, loc)
	if err != nil {
		writeAppError(w, loc, err)
		return
	}
	writeJSON(w, http.StatusOK, prizes)
}

func (s *Server) handleHighScores(w http.ResponseWriter, r *http.Request) {
	slug := domain.GameSlug(r.PathValue("slug"))
	limit := 0
	if q := r.URL.Query().Get("limit"); q != "" {
		limit, _ = strconv.Atoi(q)
	}
	loc := localeOf(r)
	scores, def, err := s.svc.HighScores(r.Context(), slug, limit)
	if err != nil {
		writeAppError(w, loc, err)
		return
	}
	// The board's game carries the score unit printed beside every row, so it
	// has to be localized here too — a Thai leaderboard reading "ms" would be
	// the one English word left on an otherwise translated screen.
	writeJSON(w, http.StatusOK, map[string]any{
		"game":   game.Localize(def, loc),
		"scores": scores,
	})
}
