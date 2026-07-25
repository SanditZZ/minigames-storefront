// Command migrate-ids rewrites persisted entity ids from UUIDv4 to nanoid(11).
//
// It converts two tables — scores.id and awards.id — and carries the reference
// between them: scores.award_id names an award, so an award that gets a new id
// must have every score pointing at it updated in the same transaction, or the
// prize a finished round won would silently detach.
//
// Session tokens are NOT touched. They are credentials rather than identifiers
// and stay UUIDv4 (see internal/id.TokenLengthNote). They also expire in
// minutes, so there is nothing worth migrating.
//
// Safety, per the repo's script rules:
//
//   - DRY RUN BY DEFAULT. The tool prints exactly what it would change and
//     exits without writing. Pass -apply to commit.
//   - REVERSIBLE. -apply first writes a timestamped JSON backup of every
//     old→new pair; -revert <file> puts them all back.
//   - IDEMPOTENT. A row whose id already has the nanoid shape is skipped, so a
//     re-run after a partial failure (or just a second run) is a no-op.
//   - AUDITABLE. Every mutation is logged with its table, old id and new id.
//
// Usage:
//
//	go run ./cmd/migrate-ids -db .prod/minigames.db              # dry run
//	go run ./cmd/migrate-ids -db .prod/minigames.db -apply       # commit
//	go run ./cmd/migrate-ids -db .prod/minigames.db -revert <f>  # undo
package main

import (
	"database/sql"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"

	"github.com/sanditzz/minigames-storefront/backend/internal/id"
)

// remap is one id rewrite. The backup is a list of these, which is all the
// information -revert needs to restore the previous state exactly.
type remap struct {
	Table string `json:"table"`
	Old   string `json:"old"`
	New   string `json:"new"`
}

// backup is the on-disk undo record written before any mutation.
type backup struct {
	CreatedAt string  `json:"createdAt"`
	Database  string  `json:"database"`
	Remaps    []remap `json:"remaps"`
}

func main() {
	var (
		dbPath    = flag.String("db", ".prod/minigames.db", "path to the SQLite database")
		apply     = flag.Bool("apply", false, "actually write the changes (default is a dry run)")
		revert    = flag.String("revert", "", "path to a backup file to undo")
		backupDir = flag.String("backup-dir", "", "where to write the undo file (default: alongside the database)")
	)
	flag.Parse()

	if err := run(*dbPath, *apply, *revert, *backupDir); err != nil {
		fmt.Fprintf(os.Stderr, "\nmigrate-ids: %v\n", err)
		os.Exit(1)
	}
}

func run(dbPath string, apply bool, revertFile, backupDir string) error {
	db, err := open(dbPath)
	if err != nil {
		return err
	}
	defer db.Close()

	if revertFile != "" {
		return runRevert(db, revertFile)
	}
	return runMigrate(db, dbPath, apply, backupDir)
}

func open(path string) (*sql.DB, error) {
	if _, err := os.Stat(path); err != nil {
		return nil, fmt.Errorf("database %s: %w", path, err)
	}
	dsn := fmt.Sprintf("file:%s?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)", path)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open %s: %w", path, err)
	}
	db.SetMaxOpenConns(1)
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("ping %s: %w", path, err)
	}
	return db, nil
}

// --- Migrate ---------------------------------------------------------------

func runMigrate(db *sql.DB, dbPath string, apply bool, backupDir string) error {
	plan, err := buildPlan(db)
	if err != nil {
		return err
	}

	fmt.Printf("Database: %s\n\n", dbPath)
	report(plan)

	if len(plan) == 0 {
		fmt.Println("Nothing to migrate — every id already has the nanoid shape.")
		return nil
	}

	if !apply {
		fmt.Printf("\nDRY RUN — no changes written. Re-run with -apply to commit these %d rewrites.\n", len(plan))
		return nil
	}

	path, err := writeBackup(plan, dbPath, backupDir)
	if err != nil {
		return fmt.Errorf("write backup: %w", err)
	}
	fmt.Printf("\nBackup written to %s\n", path)

	applied, err := applyRemaps(db, plan)
	if err != nil {
		return fmt.Errorf("apply (rolled back, database unchanged): %w", err)
	}
	fmt.Printf("Applied %d id rewrites (%d score award_id references re-pointed).\n", len(plan), applied)
	fmt.Printf("To undo: go run ./cmd/migrate-ids -db %s -revert %s\n", dbPath, path)
	return nil
}

// buildPlan collects every row still holding a non-nanoid id and assigns it a
// fresh one. Pure planning: it reads, but writes nothing.
//
// Generated ids are checked against both the ids already in the database and
// the ones minted earlier in this same run, so a collision cannot slip through
// even though the odds are negligible.
func buildPlan(db *sql.DB) ([]remap, error) {
	taken, err := existingIDs(db)
	if err != nil {
		return nil, err
	}

	var plan []remap
	for _, table := range []string{"scores", "awards"} {
		ids, err := readIDs(db, table)
		if err != nil {
			return nil, err
		}
		for _, old := range ids {
			if id.Looks(old) {
				continue // already migrated — this is what makes a re-run a no-op
			}
			fresh, err := mintUnique(taken)
			if err != nil {
				return nil, err
			}
			plan = append(plan, remap{Table: table, Old: old, New: fresh})
		}
	}
	return plan, nil
}

func mintUnique(taken map[string]bool) (string, error) {
	for attempt := 0; attempt < 100; attempt++ {
		candidate := id.New()
		if !taken[candidate] {
			taken[candidate] = true
			return candidate, nil
		}
	}
	return "", fmt.Errorf("could not mint a unique id after 100 attempts")
}

func existingIDs(db *sql.DB) (map[string]bool, error) {
	taken := map[string]bool{}
	for _, table := range []string{"scores", "awards"} {
		ids, err := readIDs(db, table)
		if err != nil {
			return nil, err
		}
		for _, v := range ids {
			taken[v] = true
		}
	}
	return taken, nil
}

// readIDs lists the primary keys of a table. The table name is a constant from
// this file's own loop, never user input, so interpolating it is safe.
func readIDs(db *sql.DB, table string) ([]string, error) {
	rows, err := db.Query(fmt.Sprintf("SELECT id FROM %s ORDER BY id", table))
	if err != nil {
		return nil, fmt.Errorf("read %s ids: %w", table, err)
	}
	defer rows.Close()

	var out []string
	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil {
			return nil, fmt.Errorf("scan %s id: %w", table, err)
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

func report(plan []remap) {
	if len(plan) == 0 {
		return
	}
	counts := map[string]int{}
	fmt.Println("Planned id rewrites:")
	for _, r := range plan {
		counts[r.Table]++
		fmt.Printf("  %-7s %-38s -> %s\n", r.Table, r.Old, r.New)
	}
	fmt.Println()
	for _, table := range []string{"scores", "awards"} {
		if n := counts[table]; n > 0 {
			fmt.Printf("  %s: %d row(s)\n", table, n)
		}
	}
}

// applyRemaps performs every rewrite in ONE transaction, so a failure halfway
// through leaves the database exactly as it was rather than half-converted.
//
// Order matters within an award rewrite: scores.award_id is re-pointed to the
// new value before (well, in the same transaction as) the award's own primary
// key changes, so no score is ever left naming an id that does not exist.
// Returns how many score→award references were re-pointed.
func applyRemaps(db *sql.DB, plan []remap) (int, error) {
	tx, err := db.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback() //nolint:errcheck // no-op once committed

	refs := 0
	for _, r := range plan {
		switch r.Table {
		case "scores":
			if _, err := tx.Exec(`UPDATE scores SET id = ? WHERE id = ?`, r.New, r.Old); err != nil {
				return 0, fmt.Errorf("scores %s: %w", r.Old, err)
			}
		case "awards":
			res, err := tx.Exec(`UPDATE scores SET award_id = ? WHERE award_id = ?`, r.New, r.Old)
			if err != nil {
				return 0, fmt.Errorf("scores.award_id -> %s: %w", r.Old, err)
			}
			n, _ := res.RowsAffected()
			refs += int(n)
			if _, err := tx.Exec(`UPDATE awards SET id = ? WHERE id = ?`, r.New, r.Old); err != nil {
				return 0, fmt.Errorf("awards %s: %w", r.Old, err)
			}
		}
		fmt.Printf("  rewrote %-7s %s -> %s\n", r.Table, r.Old, r.New)
	}
	return refs, tx.Commit()
}

func writeBackup(plan []remap, dbPath, dir string) (string, error) {
	if dir == "" {
		dir = filepath.Join(filepath.Dir(dbPath), "backups")
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	stamp := time.Now().UTC().Format("20060102T150405Z")
	path := filepath.Join(dir, fmt.Sprintf("migrate-ids-%s.json", stamp))

	body, err := json.MarshalIndent(backup{
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
		Database:  dbPath,
		Remaps:    plan,
	}, "", "  ")
	if err != nil {
		return "", err
	}
	return path, os.WriteFile(path, body, 0o644)
}

// --- Revert ----------------------------------------------------------------

// runRevert restores the ids recorded in a backup file by applying every remap
// backwards. It reuses applyRemaps, so the undo path has the same transaction
// and reference-carrying guarantees as the migration itself.
func runRevert(db *sql.DB, path string) error {
	body, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read backup: %w", err)
	}
	var b backup
	if err := json.Unmarshal(body, &b); err != nil {
		return fmt.Errorf("parse backup: %w", err)
	}

	// Swap each pair so new -> old, and reverse the order so rewrites unwind in
	// the opposite sequence to the one that created them.
	inverse := make([]remap, 0, len(b.Remaps))
	for i := len(b.Remaps) - 1; i >= 0; i-- {
		r := b.Remaps[i]
		inverse = append(inverse, remap{Table: r.Table, Old: r.New, New: r.Old})
	}

	fmt.Printf("Reverting %d id rewrites from %s (taken %s)\n\n", len(inverse), path, b.CreatedAt)
	if _, err := applyRemaps(db, inverse); err != nil {
		return fmt.Errorf("revert (rolled back, database unchanged): %w", err)
	}
	fmt.Printf("\nReverted %d id rewrites.\n", len(inverse))
	return nil
}
