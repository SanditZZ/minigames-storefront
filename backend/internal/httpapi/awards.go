package httpapi

import (
	"net/http"
	"time"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
	"github.com/sanditzz/minigames-storefront/backend/internal/id"
)

// awardRequest is the admin-editable shape of an award. IDs and timestamps are
// server-managed and therefore not accepted from the client on create.
type awardRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	// Optional Thai text. Omitted or "" means "not translated", and the player
	// then reads the English — validateAward deliberately does NOT require them.
	// A venue with an English-only prize list is a supported configuration, and
	// refusing to save a prize without a translation would make this feature a
	// tax on the stores that do not need it.
	NameTH        string          `json:"nameTh"`
	DescriptionTH string          `json:"descriptionTh"`
	ImageURL      string          `json:"imageUrl"`
	GameSlug      domain.GameSlug `json:"gameSlug"`
	MinScore      int             `json:"minScore"`
	Stock         int             `json:"stock"`
	Active        bool            `json:"active"`
	SortOrder     int             `json:"sortOrder"`
}

func (s *Server) handleListAwards(w http.ResponseWriter, r *http.Request) {
	awards, err := s.svc.Store().Awards().List(r.Context())
	if err != nil {
		writeAppError(w, localeOf(r), err)
		return
	}
	if awards == nil {
		awards = []domain.Award{}
	}
	writeJSON(w, http.StatusOK, awards)
}

func (s *Server) handleGetAward(w http.ResponseWriter, r *http.Request) {
	a, err := s.svc.Store().Awards().Get(r.Context(), r.PathValue("id"))
	if err != nil {
		writeAppError(w, localeOf(r), err)
		return
	}
	writeJSON(w, http.StatusOK, a)
}

func (s *Server) handleCreateAward(w http.ResponseWriter, r *http.Request) {
	var req awardRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if msg, ok := validateAward(req); !ok {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	now := time.Now()
	a := domain.Award{
		ID:            id.New(),
		Name:          req.Name,
		Description:   req.Description,
		NameTH:        req.NameTH,
		DescriptionTH: req.DescriptionTH,
		ImageURL:      req.ImageURL,
		GameSlug:      req.GameSlug,
		MinScore:      req.MinScore,
		Stock:         req.Stock,
		Active:        req.Active,
		SortOrder:     req.SortOrder,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	created, err := s.svc.Store().Awards().Create(r.Context(), a)
	if err != nil {
		writeAppError(w, localeOf(r), err)
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func (s *Server) handleUpdateAward(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	existing, err := s.svc.Store().Awards().Get(r.Context(), id)
	if err != nil {
		writeAppError(w, localeOf(r), err)
		return
	}
	var req awardRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if msg, ok := validateAward(req); !ok {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	// Preserve server-managed fields; apply editable ones.
	existing.Name = req.Name
	existing.Description = req.Description
	// Assigned unconditionally, so clearing a translation in the form actually
	// removes it. A "only overwrite when non-empty" shortcut here would pin the
	// first Thai name an operator ever saved.
	existing.NameTH = req.NameTH
	existing.DescriptionTH = req.DescriptionTH
	existing.ImageURL = req.ImageURL
	existing.GameSlug = req.GameSlug
	existing.MinScore = req.MinScore
	existing.Stock = req.Stock
	existing.Active = req.Active
	existing.SortOrder = req.SortOrder
	existing.UpdatedAt = time.Now()

	updated, err := s.svc.Store().Awards().Update(r.Context(), existing)
	if err != nil {
		writeAppError(w, localeOf(r), err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) handleDeleteAward(w http.ResponseWriter, r *http.Request) {
	if err := s.svc.Store().Awards().Delete(r.Context(), r.PathValue("id")); err != nil {
		writeAppError(w, localeOf(r), err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// validateAward enforces the invariants the admin UI should already respect but
// the server must guarantee regardless of client.
func validateAward(req awardRequest) (string, bool) {
	if req.Name == "" {
		return "name is required", false
	}
	if req.MinScore < 0 {
		return "minScore cannot be negative", false
	}
	if req.Stock < domain.Unlimited {
		return "stock must be -1 (unlimited) or a non-negative number", false
	}
	return "", true
}
