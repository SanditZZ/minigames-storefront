package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
	"github.com/sanditzz/minigames-storefront/backend/internal/storage"
)

type scoreRepo struct{ db *sql.DB }

const scoreCols = `id, game_slug, player_name, value, award_id, created_at`

func (r *scoreRepo) Create(ctx context.Context, e domain.ScoreEntry) (domain.ScoreEntry, error) {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO scores (id, game_slug, player_name, value, award_id, created_at)
		VALUES (?, ?, ?, ?, ?, ?)`,
		e.ID, e.GameSlug, e.PlayerName, e.Value, e.AwardID, fmtTime(e.CreatedAt))
	if err != nil {
		return domain.ScoreEntry{}, fmt.Errorf("create score: %w", err)
	}
	return e, nil
}

// Get loads a single round by id. This is the read side of a permanent result
// URL: the player app resolves /result/{slug}/{id} through it after a reload or
// a shared link.
func (r *scoreRepo) Get(ctx context.Context, id string) (domain.ScoreEntry, error) {
	row := r.db.QueryRowContext(ctx, `SELECT `+scoreCols+` FROM scores WHERE id = ?`, id)
	var (
		e       domain.ScoreEntry
		created string
	)
	err := row.Scan(&e.ID, &e.GameSlug, &e.PlayerName, &e.Value, &e.AwardID, &created)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.ScoreEntry{}, storage.ErrNotFound
	}
	if err != nil {
		return domain.ScoreEntry{}, fmt.Errorf("get score: %w", err)
	}
	e.CreatedAt = parseTime(created)
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
		SELECT `+scoreCols+`
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
		if err := rows.Scan(&e.ID, &e.GameSlug, &e.PlayerName, &e.Value, &e.AwardID, &created); err != nil {
			return nil, fmt.Errorf("scan score: %w", err)
		}
		e.CreatedAt = parseTime(created)
		out = append(out, e)
	}
	return out, rows.Err()
}
