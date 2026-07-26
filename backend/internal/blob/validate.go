package blob

import (
	"net/http"
	"strings"

	"github.com/sanditzz/minigames-storefront/backend/internal/id"
)

// MaxUploadBytes caps an upload at 2 MiB.
//
// These are a store logo and prize photos rendered into a card no wider than a
// phone, so 2 MiB is generous for the job and small enough that the cap is the
// disk-exhaustion answer too: there is no quota anywhere else, and an admin
// token that can write files is a token that can fill a disk.
const MaxUploadBytes int64 = 2 << 20

// sniffLen is what http.DetectContentType reads. Callers must hand at least
// this many bytes (or the whole file, if shorter) to DetectImageType.
const sniffLen = 512

// allowedTypes maps an accepted image type to the extension objects get.
//
// SVG is deliberately absent. It is the one image format that is also a
// document: it can carry <script>, and these files are served from the API's
// own origin, so accepting one would turn "upload a logo" into stored XSS
// against every admin session. There is no sanitiser here worth trusting;
// raster only.
var allowedTypes = map[string]string{
	"image/png":  ".png",
	"image/jpeg": ".jpg",
	"image/webp": ".webp",
	"image/gif":  ".gif",
}

// DetectImageType identifies an upload from its leading bytes and reports
// whether it is an image type this store accepts.
//
// It sniffs rather than trusting the multipart part's Content-Type header,
// because that header is written by the client and is therefore a claim, not a
// fact. The extension returned is derived from the sniffed type for the same
// reason — a file named `logo.png` that is actually something else gets stored
// under whatever it really is, or rejected.
func DetectImageType(head []byte) (contentType, extension string, ok bool) {
	if len(head) > sniffLen {
		head = head[:sniffLen]
	}
	detected := http.DetectContentType(head)
	// DetectContentType can return "image/png; charset=..." shapes for some
	// types; compare on the media type alone.
	if i := strings.IndexByte(detected, ';'); i >= 0 {
		detected = strings.TrimSpace(detected[:i])
	}
	ext, allowed := allowedTypes[detected]
	if !allowed {
		return detected, "", false
	}
	return detected, ext, true
}

// AllowedTypeList is the accepted media types, for error messages and the
// admin's file picker.
func AllowedTypeList() []string {
	out := make([]string, 0, len(allowedTypes))
	for t := range allowedTypes {
		out = append(out, t)
	}
	return out
}

// NewObjectName mints the name an upload is stored under: a fresh nanoid plus
// the extension for its sniffed type.
//
// The client's filename is DISCARDED rather than sanitised. Sanitising is the
// usual answer and it is a permanent source of bugs — `..%2f`, NUL bytes,
// Windows device names, Unicode look-alikes, case-insensitive filesystems
// colliding `Logo.png` with `logo.png`. None of that can arise if the name
// never comes from the client in the first place, and nothing here needs the
// original: these objects are referenced by URL, never browsed by name.
func NewObjectName(extension string) string {
	return id.New() + extension
}

// IsSafeObjectName reports whether a name is one this package could have
// minted: nanoid characters, then a known extension, and nothing else.
//
// Names are generated here, so in principle this can never fail — it exists
// because the serving path takes its name from a URL, and "the only names that
// exist are safe ones" is an assumption that survives exactly until someone
// adds a second way to create one.
func IsSafeObjectName(name string) bool {
	dot := strings.LastIndexByte(name, '.')
	if dot <= 0 {
		return false
	}
	stem, ext := name[:dot], name[dot:]
	if !id.Looks(stem) {
		return false
	}
	for _, allowedExt := range allowedTypes {
		if ext == allowedExt {
			return true
		}
	}
	return false
}
