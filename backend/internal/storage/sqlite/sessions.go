package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
	"github.com/sanditzz/minigames-storefront/backend/internal/storage"
)

type sessionRepo struct{ db *sql.DB }

func (r *sessionRepo) Create(ctx context.Context, s domain.Session) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO sessions (token, game_slug, issued_at, expires_at, consumed_at)
		VALUES (?, ?, ?, ?, ?)`,
		s.Token, s.GameSlug, fmtTime(s.IssuedAt), fmtTime(s.ExpiresAt), fmtNullTime(s.ConsumedAt))
	if err != nil {
		return fmt.Errorf("create session: %w", err)
	}
	return nil
}

func (r *sessionRepo) Get(ctx context.Context, token string) (domain.Session, error) {
	return scanSession(r.db.QueryRowContext(ctx, `
		SELECT token, game_slug, issued_at, expires_at, consumed_at
		FROM sessions WHERE token = ?`, token))
}

// Consume atomically flips consumed_at from NULL to now. The WHERE clause makes
// the update a no-op if the session is already consumed; we detect that via
// RowsAffected and return ErrConflict, so a replayed submit cannot double-score.
func (r *sessionRepo) Consume(ctx context.Context, token string) (domain.Session, error) {
	now := fmtTime(time.Now())
	res, err := r.db.ExecContext(ctx, `
		UPDATE sessions SET consumed_at = ?
		WHERE token = ? AND consumed_at IS NULL`, now, token)
	if err != nil {
		return domain.Session{}, fmt.Errorf("consume session: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return domain.Session{}, fmt.Errorf("consume session rows: %w", err)
	}
	if n == 0 {
		// Either the token does not exist or it was already consumed.
		if _, gerr := r.Get(ctx, token); errors.Is(gerr, storage.ErrNotFound) {
			return domain.Session{}, storage.ErrNotFound
		}
		return domain.Session{}, storage.ErrConflict
	}
	return r.Get(ctx, token)
}

func scanSession(row *sql.Row) (domain.Session, error) {
	var s domain.Session
	var issued, expires string
	var consumed sql.NullString
	err := row.Scan(&s.Token, &s.GameSlug, &issued, &expires, &consumed)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Session{}, storage.ErrNotFound
	}
	if err != nil {
		return domain.Session{}, fmt.Errorf("scan session: %w", err)
	}
	s.IssuedAt = parseTime(issued)
	s.ExpiresAt = parseTime(expires)
	s.ConsumedAt = parseNullTime(consumed)
	return s, nil
}
