package blob

import (
	"bytes"
	"strings"
	"testing"

	"github.com/sanditzz/minigames-storefront/backend/internal/id"
)

// Minimal real headers — DetectContentType reads magic bytes, so these are the
// actual signatures rather than invented ones.
var (
	pngHeader  = []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR")
	jpegHeader = []byte("\xff\xd8\xff\xe0\x00\x10JFIF\x00")
	gifHeader  = []byte("GIF89a\x01\x00\x01\x00")
	webpHeader = []byte("RIFF\x24\x00\x00\x00WEBPVP8 ")
)

func TestDetectImageTypeAcceptsTheRasterFormats(t *testing.T) {
	cases := map[string]struct {
		head []byte
		want string
		ext  string
	}{
		"png":  {pngHeader, "image/png", ".png"},
		"jpeg": {jpegHeader, "image/jpeg", ".jpg"},
		"gif":  {gifHeader, "image/gif", ".gif"},
		"webp": {webpHeader, "image/webp", ".webp"},
	}
	for name, c := range cases {
		got, ext, ok := DetectImageType(c.head)
		if !ok || got != c.want || ext != c.ext {
			t.Errorf("%s: got (%q, %q, %v), want (%q, %q, true)", name, got, ext, ok, c.want, c.ext)
		}
	}
}

// SVG is an image format that is also a document: it can carry <script>, and
// these objects are served from the API's own origin. Accepting one would turn
// "upload a logo" into stored XSS against every admin session.
func TestDetectImageTypeRejectsSVGAndNonImages(t *testing.T) {
	for name, head := range map[string][]byte{
		"svg":        []byte(`<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`),
		"html":       []byte("<!DOCTYPE html><html><body>hi</body></html>"),
		"plain text": []byte("just some text, honestly"),
		"elf binary": []byte("\x7fELF\x02\x01\x01\x00"),
		"empty":      {},
	} {
		if _, _, ok := DetectImageType(head); ok {
			t.Errorf("%s: accepted, want rejected", name)
		}
	}
}

// The declared Content-Type is a claim by the client; the bytes are the fact.
// A PNG renamed and re-declared as a JPEG is stored as what it actually is.
func TestDetectImageTypeIgnoresWhatTheFileClaimsToBe(t *testing.T) {
	got, ext, ok := DetectImageType(pngHeader)
	if !ok || got != "image/png" || ext != ".png" {
		t.Fatalf("got (%q, %q, %v), want image/png/.png", got, ext, ok)
	}
}

func TestDetectImageTypeReadsOnlyTheSniffWindow(t *testing.T) {
	// A PNG header followed by a megabyte of noise is still a PNG, and passing
	// a huge slice must not change the answer.
	head := append(append([]byte{}, pngHeader...), bytes.Repeat([]byte{0xAB}, 4096)...)
	if _, _, ok := DetectImageType(head); !ok {
		t.Error("long buffer rejected, want accepted")
	}
}

func TestNewObjectNameIsANanoidPlusExtension(t *testing.T) {
	name := NewObjectName(".png")
	if !strings.HasSuffix(name, ".png") {
		t.Fatalf("name = %q, want a .png suffix", name)
	}
	if stem := strings.TrimSuffix(name, ".png"); !id.Looks(stem) {
		t.Errorf("stem %q is not a nanoid — every persisted name uses internal/id", stem)
	}
	if NewObjectName(".png") == name {
		t.Error("two calls produced the same name")
	}
}

// The client's filename never reaches the filesystem, so none of these can
// arise — this asserts the serving path would still refuse them if a second
// way to create a name ever appeared.
func TestIsSafeObjectNameRejectsAnythingItCouldNotHaveMinted(t *testing.T) {
	good := NewObjectName(".png")
	if !IsSafeObjectName(good) {
		t.Fatalf("IsSafeObjectName(%q) = false, want true", good)
	}

	for name, why := range map[string]string{
		"../../etc/passwd":     "traversal",
		"..%2f..%2fpasswd":     "encoded traversal",
		"/etc/passwd":          "absolute path",
		"logo.png":             "not a minted stem",
		"":                     "empty",
		".png":                 "extension only",
		"abcdefghijk":          "no extension",
		"abcdefghijk.svg":      "extension not in the allowlist",
		"abcdefghijk.png.exe":  "double extension",
		"abcdefghij.png":       "stem one character short of a nanoid",
		"abcdefghijk/../x.png": "traversal inside a plausible name",
	} {
		if IsSafeObjectName(name) {
			t.Errorf("IsSafeObjectName(%q) = true, want false: %s", name, why)
		}
	}
}

func TestMaxUploadBytesIsTheDiskQuotaToo(t *testing.T) {
	// Nothing else in the system bounds how much an admin token can write, so
	// this constant is load-bearing beyond "reject a huge photo".
	if MaxUploadBytes <= 0 || MaxUploadBytes > 8<<20 {
		t.Errorf("MaxUploadBytes = %d, want a small positive cap", MaxUploadBytes)
	}
}
