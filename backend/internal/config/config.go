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
}

// Load reads config from env with sensible local-dev defaults.
func Load() Config {
	return Config{
		Addr:        env("APP_ADDR", ":8080"),
		DBPath:      env("APP_DB_PATH", "minigames.db"),
		CORSOrigins: env("APP_CORS_ORIGINS", "http://localhost:5173,http://localhost:5174"),
		AdminToken:  env("APP_ADMIN_TOKEN", "dev-admin-token"),
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
