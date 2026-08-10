// Package config loads process configuration from the environment. This is an
// ACTION-adjacent concern (it reads the outside world) but stays tiny and
// dependency-free so it can be imported anywhere at startup.
package config

import (
	"os"
	"strconv"
)

// Config holds server-level settings. Business-tunable knobs (session TTL, tap
// caps, etc.) live in the Settings store so admins can change them at runtime;
// this struct only holds process/deploy concerns.
type Config struct {
	Addr        string // listen address, e.g. ":8080"
	DBPath      string // sqlite file path
	CORSOrigins string // comma-separated allowed origins for the browser apps
	AdminToken  string // shared secret guarding /api/v1/admin/* ("" = open, dev only)
	UploadDir   string // directory uploaded images are stored in
	// PublicURL is the absolute base this API is reached at, used to build
	// object URLs. It must be the address the BROWSER uses, not a loopback
	// one: the frontends are built with an absolute API URL baked in and run
	// on their own origin, so an object URL pointing at localhost resolves to
	// the player's own device. See scripts/serve-prod.sh, which passes the
	// same value it bakes into the bundles.
	PublicURL string
	// RateLimitPerMinute and RateLimitBurst bound the unauthenticated public
	// reads (awards, public settings, score lookup) per client IP. See
	// internal/httpapi/ratelimit.go for why these three and not every route.
	RateLimitPerMinute int
	RateLimitBurst     int
}

// Load reads config from env with sensible local-dev defaults.
func Load() Config {
	return Config{
		Addr:               env("APP_ADDR", ":8080"),
		DBPath:             env("APP_DB_PATH", "minigames.db"),
		CORSOrigins:        env("APP_CORS_ORIGINS", "http://localhost:5173,http://localhost:5174"),
		AdminToken:         env("APP_ADMIN_TOKEN", "admin"),
		UploadDir:          env("APP_UPLOAD_DIR", "uploads"),
		PublicURL:          env("APP_PUBLIC_URL", "http://localhost:8080"),
		RateLimitPerMinute: EnvInt("APP_RATE_LIMIT_PER_MINUTE", 60),
		RateLimitBurst:     EnvInt("APP_RATE_LIMIT_BURST", 10),
	}
}

func env(key, def string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return def
}

// EnvInt reads an integer env var with a default. Exported for reuse.
func EnvInt(key string, def int) int {
	if v, ok := os.LookupEnv(key); ok {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}
