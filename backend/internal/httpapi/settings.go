package httpapi

import (
	"net/http"
	"strconv"
	"time"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
)

func (s *Server) handleListSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := s.svc.Store().Settings().List(r.Context())
	if err != nil {
		writeAppError(w, err)
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
		writeAppError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, set)
}

func (s *Server) handleDeleteSetting(w http.ResponseWriter, r *http.Request) {
	if err := s.svc.Store().Settings().Delete(r.Context(), r.PathValue("key")); err != nil {
		writeAppError(w, err)
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
	case domain.SettingString:
		// any string is valid
	default:
		return "unknown setting type", false
	}
	return "", true
}
