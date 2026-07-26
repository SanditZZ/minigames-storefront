package httpapi

import (
	"net/http"
	"strconv"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
	"github.com/sanditzz/minigames-storefront/backend/internal/game"
	"github.com/sanditzz/minigames-storefront/backend/internal/i18n"
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
type startSessionResponse struct {
	Token      string          `json:"token"`
	GameSlug   domain.GameSlug `json:"gameSlug"`
	DurationMs int             `json:"durationMs"`
	ExpiresAt  string          `json:"expiresAt"`
}

func (s *Server) handleStartSession(w http.ResponseWriter, r *http.Request) {
	slug := domain.GameSlug(r.PathValue("slug"))
	sess, def, err := s.svc.StartSession(r.Context(), slug)
	if err != nil {
		writeAppError(w, localeOf(r), err)
		return
	}
	writeJSON(w, http.StatusCreated, startSessionResponse{
		Token:      sess.Token,
		GameSlug:   sess.GameSlug,
		DurationMs: def.DurationMs,
		ExpiresAt:  sess.ExpiresAt.Format(timeFormat),
	})
}

// submitScoreRequest is the client payload. Elapsed time is deliberately NOT
// accepted from the client — the server derives it from the session.
type submitScoreRequest struct {
	Token      string `json:"token"`
	PlayerName string `json:"playerName"`
	Value      int    `json:"value"`
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
	writeJSON(w, http.StatusCreated, result)
}

// handleGetScore serves a single finished round, so the player app's result URL
// survives a reload or being shared. Same response shape as a submission, minus
// the side effects.
func (s *Server) handleGetScore(w http.ResponseWriter, r *http.Request) {
	slug := domain.GameSlug(r.PathValue("slug"))
	result, err := s.svc.ScoreResult(r.Context(), slug, r.PathValue("id"))
	if err != nil {
		writeAppError(w, localeOf(r), err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

// handlePrizes serves the prizes a game is offering, for the landing screen's
// showcase. Public by design — it is advertising — and it returns the trimmed
// reward.PublicAward shape, never raw awards with their stock levels.
func (s *Server) handlePrizes(w http.ResponseWriter, r *http.Request) {
	slug := domain.GameSlug(r.PathValue("slug"))
	// The prizes themselves are NOT localized: an award's name and description
	// are admin-entered free text, so translating them is a schema change
	// (awards.name_th) rather than a lookup — see the note in internal/i18n and
	// the entry in docs/potential-features.md.
	prizes, err := s.svc.Prizes(r.Context(), slug)
	if err != nil {
		writeAppError(w, localeOf(r), err)
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
