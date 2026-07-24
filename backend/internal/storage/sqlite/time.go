package sqlite

import (
	"database/sql"
	"time"
)

// Times are persisted as RFC3339Nano UTC strings. Doing the formatting
// ourselves (rather than relying on driver time handling) keeps round-tripping
// deterministic across SQLite driver versions and maps cleanly to a string
// attribute in DynamoDB later.

func fmtTime(t time.Time) string {
	return t.UTC().Format(time.RFC3339Nano)
}

func parseTime(s string) time.Time {
	t, err := time.Parse(time.RFC3339Nano, s)
	if err != nil {
		return time.Time{}
	}
	return t.UTC()
}

// fmtNullTime renders a *time.Time as a nullable column value.
func fmtNullTime(t *time.Time) sql.NullString {
	if t == nil {
		return sql.NullString{}
	}
	return sql.NullString{String: fmtTime(*t), Valid: true}
}

// parseNullTime reads a nullable timestamp column into a *time.Time.
func parseNullTime(ns sql.NullString) *time.Time {
	if !ns.Valid || ns.String == "" {
		return nil
	}
	t := parseTime(ns.String)
	return &t
}
