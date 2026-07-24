package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
	"github.com/sanditzz/minigames-storefront/backend/internal/storage"
)

type settingRepo struct{ db *sql.DB }

func (r *settingRepo) List(ctx context.Context) ([]domain.Setting, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT key, value, type, description, updated_at FROM settings ORDER BY key`)
	if err != nil {
		return nil, fmt.Errorf("list settings: %w", err)
	}
	defer rows.Close()

	var out []domain.Setting
	for rows.Next() {
		var s domain.Setting
		var updated string
		if err := rows.Scan(&s.Key, &s.Value, &s.Type, &s.Description, &updated); err != nil {
			return nil, fmt.Errorf("scan setting: %w", err)
		}
		s.UpdatedAt = parseTime(updated)
		out = append(out, s)
	}
	return out, rows.Err()
}

func (r *settingRepo) Get(ctx context.Context, key string) (domain.Setting, error) {
	var s domain.Setting
	var updated string
	err := r.db.QueryRowContext(ctx, `
		SELECT key, value, type, description, updated_at FROM settings WHERE key = ?`, key).
		Scan(&s.Key, &s.Value, &s.Type, &s.Description, &updated)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Setting{}, storage.ErrNotFound
	}
	if err != nil {
		return domain.Setting{}, fmt.Errorf("get setting: %w", err)
	}
	s.UpdatedAt = parseTime(updated)
	return s, nil
}

func (r *settingRepo) Upsert(ctx context.Context, s domain.Setting) (domain.Setting, error) {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO settings (key, value, type, description, updated_at)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(key) DO UPDATE SET
			value=excluded.value, type=excluded.type,
			description=excluded.description, updated_at=excluded.updated_at`,
		s.Key, s.Value, s.Type, s.Description, fmtTime(s.UpdatedAt))
	if err != nil {
		return domain.Setting{}, fmt.Errorf("upsert setting: %w", err)
	}
	return s, nil
}

func (r *settingRepo) Delete(ctx context.Context, key string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM settings WHERE key = ?`, key)
	if err != nil {
		return fmt.Errorf("delete setting: %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return storage.ErrNotFound
	}
	return nil
}
