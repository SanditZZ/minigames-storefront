package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
	"github.com/sanditzz/minigames-storefront/backend/internal/storage"
	sqlitedrv "modernc.org/sqlite"
)

type claimRepo struct{ db *sql.DB }

const claimCols = `id, code, score_id, award_id, award_name, award_name_th, issued_at, expires_at, redeemed_at`

// sqliteConstraint is SQLITE_CONSTRAINT. The driver reports the extended codes
// (SQLITE_CONSTRAINT_UNIQUE = 2067, _PRIMARYKEY = 1555), and every extended
// code carries its primary code in the low byte — so masking catches the whole
// family without listing them.
const sqliteConstraint = 19

// isConstraintViolation reports whether err is the database refusing a write
// that would break a constraint — here, a duplicate claim code.
//
// It inspects the driver's error code rather than matching on message text,
// which would break silently the first time an upstream release rewords
// "UNIQUE constraint failed".
func isConstraintViolation(err error) bool {
	var serr *sqlitedrv.Error
	if !errors.As(err, &serr) {
		return false
	}
	return serr.Code()&0xff == sqliteConstraint
}

// Create inserts a newly issued claim, translating a duplicate code into
// ErrConflict so the caller can retry with a freshly minted one.
func (r *claimRepo) Create(ctx context.Context, c domain.Claim) (domain.Claim, error) {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO claims (id, code, score_id, award_id, award_name, award_name_th, issued_at, expires_at, redeemed_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		c.ID, c.Code, c.ScoreID, c.AwardID, c.AwardName, c.AwardNameTH,
		fmtTime(c.IssuedAt), fmtOptionalTime(c.ExpiresAt), fmtNullTime(c.RedeemedAt))
	if isConstraintViolation(err) {
		return domain.Claim{}, storage.ErrConflict
	}
	if err != nil {
		return domain.Claim{}, fmt.Errorf("create claim: %w", err)
	}
	return c, nil
}

func (r *claimRepo) GetByCode(ctx context.Context, code string) (domain.Claim, error) {
	return scanClaim(r.db.QueryRowContext(ctx,
		`SELECT `+claimCols+` FROM claims WHERE code = ?`, code))
}

func (r *claimRepo) GetByScore(ctx context.Context, scoreID string) (domain.Claim, error) {
	return scanClaim(r.db.QueryRowContext(ctx,
		`SELECT `+claimCols+` FROM claims WHERE score_id = ?`, scoreID))
}

// List returns every claim, newest first. There is no status filter here on
// purpose — see the note on storage.ClaimRepository.
func (r *claimRepo) List(ctx context.Context) ([]domain.Claim, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT `+claimCols+` FROM claims ORDER BY issued_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("list claims: %w", err)
	}
	defer rows.Close()

	var out []domain.Claim
	for rows.Next() {
		c, err := scanClaimRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// Redeem atomically flips redeemed_at from NULL to `at`.
//
// The WHERE clause is the guard, not a prior read: two admins scanning the same
// code at the same counter both reach this statement, and only one of them
// updates a row. The other gets RowsAffected 0 and an ErrConflict, which is the
// difference between "the prize was handed over once" and "twice".
//
// Expiry is NOT checked here. It is a calculation (claim.CanRedeem) the service
// runs first; re-deriving it in SQL is the duplication this design avoids, and
// the race it would close is a claim that expired between the two statements —
// microseconds of a window on a deadline measured in days.
func (r *claimRepo) Redeem(ctx context.Context, code string, at time.Time) (domain.Claim, error) {
	res, err := r.db.ExecContext(ctx, `
		UPDATE claims SET redeemed_at = ?
		WHERE code = ? AND redeemed_at IS NULL`, fmtTime(at), code)
	if err != nil {
		return domain.Claim{}, fmt.Errorf("redeem claim: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return domain.Claim{}, fmt.Errorf("redeem claim rows: %w", err)
	}
	if n == 0 {
		// Either the code does not exist or it was already redeemed. Telling
		// those apart matters: one is a mistyped code, the other is a prize
		// someone has already collected.
		if _, gerr := r.GetByCode(ctx, code); errors.Is(gerr, storage.ErrNotFound) {
			return domain.Claim{}, storage.ErrNotFound
		}
		return domain.Claim{}, storage.ErrConflict
	}
	return r.GetByCode(ctx, code)
}

// rowScanner is satisfied by both *sql.Row and *sql.Rows, so the single-row and
// list paths share one column ordering.
type rowScanner interface {
	Scan(dest ...any) error
}

func scanClaim(row *sql.Row) (domain.Claim, error) {
	c, err := scanClaimRow(row)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Claim{}, storage.ErrNotFound
	}
	return c, err
}

func scanClaimRow(row rowScanner) (domain.Claim, error) {
	var (
		c                 domain.Claim
		issued            string
		expires, redeemed sql.NullString
	)
	err := row.Scan(&c.ID, &c.Code, &c.ScoreID, &c.AwardID, &c.AwardName, &c.AwardNameTH, &issued, &expires, &redeemed)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Claim{}, err // translated by scanClaim; List cannot hit this
	}
	if err != nil {
		return domain.Claim{}, fmt.Errorf("scan claim: %w", err)
	}
	c.IssuedAt = parseTime(issued)
	c.ExpiresAt = parseOptionalTime(expires)
	c.RedeemedAt = parseNullTime(redeemed)
	return c, nil
}
