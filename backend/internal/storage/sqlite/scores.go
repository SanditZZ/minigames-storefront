package sqlite

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
)

type scoreRepo struct{ db *sql.DB }

func (r *scoreRepo) Create(ctx context.Context, e domain.ScoreEntry) (domain.ScoreEntry, error) {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO scores (id, game_slug, player_name, value, created_at)
		VALUES (?, ?, ?, ?, ?)`,
		e.ID, e.GameSlug, e.PlayerName, e.Value, fmtTime(e.CreatedAt))
	if err != nil {
		return domain.ScoreEntry{}, fmt.Errorf("create score: %w", err)
	}
	return e, nil
}

// Top returns the best entries for a game. The ordering column direction is
// chosen by the game's ScoreDirection so this one method serves both
// higher-is-better and lower-is-better games. The direction is an enum we
// control (not user input), so interpolating it into the SQL is safe.
func (r *scoreRepo) Top(ctx context.Context, slug domain.GameSlug, direction domain.ScoreDirection, limit int) ([]domain.ScoreEntry, error) {
	order := "DESC"
	if direction == domain.LowerIsBetter {
		order = "ASC"
	}
	if limit <= 0 {
		limit = 10
	}
	query := fmt.Sprintf(`
		SELECT id, game_slug, player_name, value, created_at
		FROM scores WHERE game_slug = ?
		ORDER BY value %s, created_at ASC
		LIMIT ?`, order)
	rows, err := r.db.QueryContext(ctx, query, slug, limit)
	if err != nil {
		return nil, fmt.Errorf("top scores: %w", err)
	}
	defer rows.Close()

	var out []domain.ScoreEntry
	for rows.Next() {
		var e domain.ScoreEntry
		var created string
		if err := rows.Scan(&e.ID, &e.GameSlug, &e.PlayerName, &e.Value, &created); err != nil {
			return nil, fmt.Errorf("scan score: %w", err)
		}
		e.CreatedAt = parseTime(created)
		out = append(out, e)
	}
	return out, rows.Err()
}
