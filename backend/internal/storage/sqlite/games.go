package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
	"github.com/sanditzz/minigames-storefront/backend/internal/storage"
)

type gameRepo struct{ db *sql.DB }

func (r *gameRepo) List(ctx context.Context) ([]domain.Game, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT slug, name, description, score_unit, direction, duration_ms, enabled
		FROM games ORDER BY name`)
	if err != nil {
		return nil, fmt.Errorf("list games: %w", err)
	}
	defer rows.Close()

	var out []domain.Game
	for rows.Next() {
		var g domain.Game
		var enabled int
		if err := rows.Scan(&g.Slug, &g.Name, &g.Description, &g.ScoreUnit, &g.Direction, &g.DurationMs, &enabled); err != nil {
			return nil, fmt.Errorf("scan game: %w", err)
		}
		g.Enabled = enabled == 1
		out = append(out, g)
	}
	return out, rows.Err()
}

func (r *gameRepo) Get(ctx context.Context, slug domain.GameSlug) (domain.Game, error) {
	var g domain.Game
	var enabled int
	err := r.db.QueryRowContext(ctx, `
		SELECT slug, name, description, score_unit, direction, duration_ms, enabled
		FROM games WHERE slug = ?`, slug).
		Scan(&g.Slug, &g.Name, &g.Description, &g.ScoreUnit, &g.Direction, &g.DurationMs, &enabled)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Game{}, storage.ErrNotFound
	}
	if err != nil {
		return domain.Game{}, fmt.Errorf("get game: %w", err)
	}
	g.Enabled = enabled == 1
	return g, nil
}

func (r *gameRepo) Upsert(ctx context.Context, g domain.Game) error {
	enabled := 0
	if g.Enabled {
		enabled = 1
	}
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO games (slug, name, description, score_unit, direction, duration_ms, enabled)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(slug) DO UPDATE SET
			name=excluded.name, description=excluded.description, score_unit=excluded.score_unit,
			direction=excluded.direction, duration_ms=excluded.duration_ms, enabled=excluded.enabled`,
		g.Slug, g.Name, g.Description, g.ScoreUnit, g.Direction, g.DurationMs, enabled)
	if err != nil {
		return fmt.Errorf("upsert game: %w", err)
	}
	return nil
}
