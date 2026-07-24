package httpapi

import (
	"net/http"
	"strconv"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
)

func (s *Server) handleListGames(w http.ResponseWriter, r *http.Request) {
	// Only enabled games are offered to players.
	writeJSON(w, http.StatusOK, s.svc.Registry().Enabled())
}

func (s *Server) handleGetGame(w http.ResponseWriter, r *http.Request) {
	slug := domain.GameSlug(r.PathValue("slug"))
	def, ok := s.svc.Registry().Get(slug)
	if !ok {
		writeError(w, http.StatusNotFound, "game not found")
		return
	}
	writeJSON(w, http.StatusOK, def.Game)
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
