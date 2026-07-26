package httpapi

import (
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"

	"github.com/sanditzz/minigames-storefront/backend/internal/blob"
)

// uploadResponse is what the admin stores: the absolute URL goes into an
// Award.imageUrl or the store-logo setting, and the name is what a later delete
// refers to.
type uploadResponse struct {
	URL  string `json:"url"`
	Name string `json:"name"`
}

// handleUpload accepts one image and returns where it can be fetched.
//
// The whole request is bounded before anything is read: MaxBytesReader caps the
// body, so a 4GB "image" is refused at the socket rather than after being
// buffered. The declared filename and Content-Type are both ignored — the type
// is sniffed from the bytes and the name is minted here — which is what makes
// this endpoint have no filename-sanitising code at all. See blob.NewObjectName.
func (s *Server) handleUpload(w http.ResponseWriter, r *http.Request) {
	if s.blobs == nil {
		writeError(w, http.StatusNotImplemented, "uploads are not configured")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, blob.MaxUploadBytes)
	file, _, err := r.FormFile("file")
	if err != nil {
		if strings.Contains(err.Error(), "request body too large") {
			writeError(w, http.StatusRequestEntityTooLarge,
				fmt.Sprintf("image must be under %d MB", blob.MaxUploadBytes>>20))
			return
		}
		writeError(w, http.StatusBadRequest, "expected a multipart form with a 'file' field")
		return
	}
	defer file.Close()

	// Read the sniff window, then serve it back ahead of the rest so the object
	// is written whole — the bytes used to identify it are part of the file.
	head := make([]byte, 512)
	n, err := io.ReadFull(file, head)
	if err != nil && err != io.ErrUnexpectedEOF && err != io.EOF {
		writeError(w, http.StatusBadRequest, "could not read the uploaded file")
		return
	}
	head = head[:n]

	contentType, ext, ok := blob.DetectImageType(head)
	if !ok {
		allowed := blob.AllowedTypeList()
		sort.Strings(allowed)
		writeError(w, http.StatusUnsupportedMediaType,
			fmt.Sprintf("%s is not an accepted image type (allowed: %s)", contentType, strings.Join(allowed, ", ")))
		return
	}

	name := blob.NewObjectName(ext)
	body := io.MultiReader(strings.NewReader(string(head)), file)
	if err := s.blobs.Put(r.Context(), name, contentType, body); err != nil {
		writeAppError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, uploadResponse{URL: s.blobs.URL(name), Name: name})
}

// handleDeleteUpload removes a stored object. It is idempotent: deleting a name
// that is already gone succeeds, so an admin clearing an image twice — or two
// admins clearing the same one — is not an error to explain.
func (s *Server) handleDeleteUpload(w http.ResponseWriter, r *http.Request) {
	if s.blobs == nil {
		writeError(w, http.StatusNotImplemented, "uploads are not configured")
		return
	}
	if err := s.blobs.Delete(r.Context(), r.PathValue("name")); err != nil {
		writeError(w, http.StatusBadRequest, "not an uploaded object")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
