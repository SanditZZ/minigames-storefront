package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
	"github.com/sanditzz/minigames-storefront/backend/internal/storage"
)

type awardRepo struct{ db *sql.DB }

const awardCols = `id, name, description, image_url, game_slug, min_score, stock, active, sort_order, created_at, updated_at`

func (r *awardRepo) List(ctx context.Context) ([]domain.Award, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+awardCols+` FROM awards ORDER BY sort_order, name`)
	if err != nil {
		return nil, fmt.Errorf("list awards: %w", err)
	}
	defer rows.Close()

	var out []domain.Award
	for rows.Next() {
		a, err := scanAwardRows(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (r *awardRepo) Get(ctx context.Context, id string) (domain.Award, error) {
	row := r.db.QueryRowContext(ctx, `SELECT `+awardCols+` FROM awards WHERE id = ?`, id)
	a, err := scanAwardRow(row)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Award{}, storage.ErrNotFound
	}
	return a, err
}

func (r *awardRepo) Create(ctx context.Context, a domain.Award) (domain.Award, error) {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO awards (`+awardCols+`)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		a.ID, a.Name, a.Description, a.ImageURL, a.GameSlug, a.MinScore, a.Stock,
		boolToInt(a.Active), a.SortOrder, fmtTime(a.CreatedAt), fmtTime(a.UpdatedAt))
	if err != nil {
		return domain.Award{}, fmt.Errorf("create award: %w", err)
	}
	return a, nil
}

func (r *awardRepo) Update(ctx context.Context, a domain.Award) (domain.Award, error) {
	res, err := r.db.ExecContext(ctx, `
		UPDATE awards SET name=?, description=?, image_url=?, game_slug=?, min_score=?,
			stock=?, active=?, sort_order=?, updated_at=?
		WHERE id=?`,
		a.Name, a.Description, a.ImageURL, a.GameSlug, a.MinScore, a.Stock,
		boolToInt(a.Active), a.SortOrder, fmtTime(a.UpdatedAt), a.ID)
	if err != nil {
		return domain.Award{}, fmt.Errorf("update award: %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return domain.Award{}, storage.ErrNotFound
	}
	return a, nil
}

func (r *awardRepo) Delete(ctx context.Context, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM awards WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("delete award: %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return storage.ErrNotFound
	}
	return nil
}

// DecrementStock atomically reduces stock for a limited award. Unlimited stock
// (-1) is left untouched. The WHERE guard (stock > 0) makes over-issuing
// impossible under concurrency; a zero-row update means it was out of stock.
func (r *awardRepo) DecrementStock(ctx context.Context, id string) error {
	res, err := r.db.ExecContext(ctx, `
		UPDATE awards SET stock = stock - 1
		WHERE id = ? AND stock > 0`, id)
	if err != nil {
		return fmt.Errorf("decrement stock: %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		// Distinguish "unlimited/not-found" from "out of stock".
		a, gerr := r.Get(ctx, id)
		if gerr != nil {
			return gerr
		}
		if a.Stock == domain.Unlimited {
			return nil // unlimited: nothing to decrement
		}
		return storage.ErrConflict // out of stock
	}
	return nil
}

func scanAwardRow(row *sql.Row) (domain.Award, error) {
	var a domain.Award
	var active int
	var created, updated string
	err := row.Scan(&a.ID, &a.Name, &a.Description, &a.ImageURL, &a.GameSlug,
		&a.MinScore, &a.Stock, &active, &a.SortOrder, &created, &updated)
	if err != nil {
		return domain.Award{}, err
	}
	a.Active = active == 1
	a.CreatedAt = parseTime(created)
	a.UpdatedAt = parseTime(updated)
	return a, nil
}

func scanAwardRows(rows *sql.Rows) (domain.Award, error) {
	var a domain.Award
	var active int
	var created, updated string
	err := rows.Scan(&a.ID, &a.Name, &a.Description, &a.ImageURL, &a.GameSlug,
		&a.MinScore, &a.Stock, &active, &a.SortOrder, &created, &updated)
	if err != nil {
		return domain.Award{}, fmt.Errorf("scan award: %w", err)
	}
	a.Active = active == 1
	a.CreatedAt = parseTime(created)
	a.UpdatedAt = parseTime(updated)
	return a, nil
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
