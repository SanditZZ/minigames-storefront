package httpapi

import (
	"net/http"
	"strconv"
	"time"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
	"github.com/sanditzz/minigames-storefront/backend/internal/settings"
)

// handlePublicSettings serves the allowlisted subset of settings to
// unauthenticated clients — today the storefront's name and tagline, so
// renaming the shop is an admin edit rather than a rebuild and redeploy.
//
// The allowlist is enforced in internal/settings, not here: what is safe to
// publish is a rule about the data, and a handler is the wrong place to decide
// it a second time.
//
// It is the one read served conditionally (see writeJSONRevalidated), because
// it is the shape that argument fits: every player in the venue gets the same
// handful of bytes, and a storefront's name changes perhaps twice a year. The
// player app already remembers the last answer (state/settingsCache.ts), so
// this is no longer on the render path — the ETag saves the body of a request
// that was going to be made anyway.
func (s *Server) handlePublicSettings(w http.ResponseWriter, r *http.Request) {
	all, err := s.svc.Store().Settings().List(r.Context())
	if err != nil {
		writeAppError(w, localeOf(r), err)
		return
	}
	writeJSONRevalidated(w, r, settings.Public(all))
}

func (s *Server) handleListSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := s.svc.Store().Settings().List(r.Context())
	if err != nil {
		writeAppError(w, localeOf(r), err)
		return
	}
	if settings == nil {
		settings = []domain.Setting{}
	}
	writeJSON(w, http.StatusOK, settings)
}

// settingRequest is the editable part of a setting. The key comes from the URL.
type settingRequest struct {
	Value       string             `json:"value"`
	Type        domain.SettingType `json:"type"`
	Description string             `json:"description"`
}

func (s *Server) handleUpsertSetting(w http.ResponseWriter, r *http.Request) {
	key := r.PathValue("key")
	var req settingRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Type == "" {
		req.Type = domain.SettingString
	}
	if msg, ok := validateSetting(req); !ok {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	set, err := s.svc.Store().Settings().Upsert(r.Context(), domain.Setting{
		Key:         key,
		Value:       req.Value,
		Type:        req.Type,
		Description: req.Description,
		UpdatedAt:   time.Now(),
	})
	if err != nil {
		writeAppError(w, localeOf(r), err)
		return
	}
	writeJSON(w, http.StatusOK, set)
}

func (s *Server) handleDeleteSetting(w http.ResponseWriter, r *http.Request) {
	if err := s.svc.Store().Settings().Delete(r.Context(), r.PathValue("key")); err != nil {
		writeAppError(w, localeOf(r), err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// validateSetting ensures a typed setting actually parses as its declared type,
// so a bad value is rejected at write time rather than misbehaving at read time.
func validateSetting(req settingRequest) (string, bool) {
	switch req.Type {
	case domain.SettingInt:
		if _, err := strconv.Atoi(req.Value); err != nil {
			return "value must be an integer for type int", false
		}
	case domain.SettingBool:
		if _, err := strconv.ParseBool(req.Value); err != nil {
			return "value must be true/false for type bool", false
		}
	case domain.SettingColor:
		// Rejected at write time so nothing downstream has to sanitise: this
		// value ends up in a CSS custom property on the player's document.
		if !settings.IsHexColor(req.Value) {
			return "value must be a hex colour like #ff9a86 for type color", false
		}
	case domain.SettingString:
		// any string is valid
	default:
		return "unknown setting type", false
	}
	return "", true
}
