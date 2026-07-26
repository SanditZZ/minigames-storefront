package httpapi

import (
	"net/http"
	"strconv"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
)

func (s *Server) handleListGames(w http.ResponseWriter, r *http.Request) {
	// Only enabled games are offered to players, with any admin-tuned benchmark
	// applied — see app.ListGames for why that layering happens on read.
	writeJSON(w, http.StatusOK, s.svc.ListGames(r.Context()))
}

func (s *Server) handleGetGame(w http.ResponseWriter, r *http.Request) {
	g, err := s.svc.GetGame(r.Context(), domain.GameSlug(r.PathValue("slug")))
	if err != nil {
		writeError(w, http.StatusNotFound, "game not found")
		return
	}
	writeJSON(w, http.StatusOK, g)
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
	sess, game, err := s.svc.StartSession(r.Context(), slug)
	if err != nil {
		writeAppError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, startSessionResponse{
		Token:      sess.Token,
		GameSlug:   sess.GameSlug,
		DurationMs: game.DurationMs,
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
	slug := domain.GameSlug(r.PathValue("slug"))
	var req submitScoreRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Token == "" {
		writeError(w, http.StatusBadRequest, "token is required")
		return
	}
	result, err := s.svc.SubmitScore(r.Context(), toSubmitInput(slug, req))
	if err != nil {
		writeAppError(w, err)
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
		writeAppError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

// handlePrizes serves the prizes a game is offering, for the landing screen's
// showcase. Public by design — it is advertising — and it returns the trimmed
// reward.PublicAward shape, never raw awards with their stock levels.
func (s *Server) handlePrizes(w http.ResponseWriter, r *http.Request) {
	slug := domain.GameSlug(r.PathValue("slug"))
	prizes, err := s.svc.Prizes(r.Context(), slug)
	if err != nil {
		writeAppError(w, err)
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
	scores, game, err := s.svc.HighScores(r.Context(), slug, limit)
	if err != nil {
		writeAppError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"game":   game,
		"scores": scores,
	})
}
