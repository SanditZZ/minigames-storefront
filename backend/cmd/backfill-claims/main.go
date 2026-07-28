// Command backfill-claims issues the prize claims that winning rounds should
// have earned but never did.
//
// Two ways a win ends up with no claim, and this repairs both:
//
//   - The round predates the claims table entirely. Those scores carry an
//     award_id and nothing else, so their result URLs name a prize with no code
//     to collect it with.
//   - The claim failed to write at submit time. app.Service.issueClaim logs and
//     returns nil rather than failing the submission — the score is committed
//     and the stock already spent by then, so refusing the round would be worse
//     — which leaves the same shape of hole. This is the repair path that entry
//     in docs/potential-features.md points at.
//
// The claim is reconstructed with internal/claim.Issue, the SAME calculation
// the live path uses, so a backfilled claim cannot disagree with an issued one
// about anything. That has one consequence worth knowing before running it:
// Issue starts the redemption window at the ROUND's time, not at now, so
// backfilling a round older than the configured TTL produces a claim that is
// already expired. That is the honest reconstruction — the window really did
// close — and it is still worth writing, because an expired row is a record the
// counter can look up and "no row at all" is not. The report says how many land
// that way rather than leaving it to be discovered.
//
// Safety, per the repo's script rules:
//
//   - DRY RUN BY DEFAULT. Prints exactly what it would issue and exits without
//     writing. Pass -apply to commit.
//   - REVERSIBLE. -apply first writes a timestamped JSON backup of every claim
//     it is about to create; -revert <file> deletes exactly those rows.
//   - IDEMPOTENT. A score that already has a claim is not in the plan, so a
//     re-run after a partial failure issues only what is still missing. The
//     plan is re-derived from the database every time, never from the backup.
//   - AUDITABLE. Every claim is logged with its score, code and award.
//
// -check is the detection half, and it exists because nothing else notices.
// issueClaim logs and returns nil, so a failed write leaves a winning round with
// no code and no signal — the interval between that and someone thinking to run
// the repair is otherwise unbounded. -check reads and writes nothing, exits 2
// when there is something to repair, and is meant to be run from cron or from
// ship.sh. It is deliberately a separate mode rather than a side effect of the
// dry run: a dry run reports what it WOULD do and succeeds, and a check has to
// fail for anyone downstream to hear it.
//
// Usage:
//
//	go run ./cmd/backfill-claims -db ../.prod/minigames.db              # dry run
//	go run ./cmd/backfill-claims -db ../.prod/minigames.db -check       # detect only
//	go run ./cmd/backfill-claims -db ../.prod/minigames.db -apply       # commit
//	go run ./cmd/backfill-claims -db ../.prod/minigames.db -revert <f>  # undo
//
// Stop the stack (./scripts/serve-prod.sh --stop) before applying: the running
// API holds the same SQLite file, and a claim issued underneath it is not in
// any cache it keeps, but the write lock is worth not fighting over. -check
// takes no write lock, so it is safe against a live database.
package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "modernc.org/sqlite"

	"github.com/sanditzz/minigames-storefront/backend/internal/claim"
	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
	"github.com/sanditzz/minigames-storefront/backend/internal/id"
)

// win is a round that won a prize, as this script needs to see it: the score's
// identity and when it happened, plus the award it names.
type win struct {
	ScoreID    string
	GameSlug   string
	PlayerName string
	AwardID    string
	CreatedAt  time.Time
}

// backup is the on-disk undo record, written before any insert.
//
// It holds the whole claim rather than just its id so the file is readable on
// its own — an operator looking at it months later can see which prize each
// code was for without joining it back to a database that has since changed.
type backup struct {
	CreatedAt string         `json:"createdAt"`
	Database  string         `json:"database"`
	Claims    []domain.Claim `json:"claims"`
}

// config is every choice the run makes, gathered so the call sites read as the
// mode they are in rather than as a row of bare booleans.
type config struct {
	dbPath    string
	check     bool
	apply     bool
	revert    string
	backupDir string
}

// Exit codes. A caller — cron, ship.sh — has to be able to tell "this database
// has a hole in it" from "this script could not read the database", because the
// first is a finding about the data and the second is a broken check reporting
// nothing at all. Both are non-zero, so a caller that only tests for failure
// still behaves.
const (
	exitFailed = 1 // the run itself failed; nothing was learned
	exitFound  = 2 // -check ran fine and found wins that need repairing
)

// errNeedsRepair is what -check returns when it found something. It carries the
// summary line rather than a stack of detail — the detail is already on stdout.
var errNeedsRepair = errors.New("winning rounds are missing their claims")

func main() {
	var cfg config
	flag.StringVar(&cfg.dbPath, "db", "../.prod/minigames.db", "path to the SQLite database")
	flag.BoolVar(&cfg.check, "check", false, "report unclaimed wins and exit non-zero; never writes")
	flag.BoolVar(&cfg.apply, "apply", false, "actually write the claims (default is a dry run)")
	flag.StringVar(&cfg.revert, "revert", "", "path to a backup file to undo")
	flag.StringVar(&cfg.backupDir, "backup-dir", "", "where to write the undo file (default: alongside the database)")
	flag.Parse()

	err := run(cfg)
	switch {
	case err == nil:
		return
	case errors.Is(err, errNeedsRepair):
		fmt.Fprintf(os.Stderr, "\nbackfill-claims: %v\n", err)
		os.Exit(exitFound)
	default:
		fmt.Fprintf(os.Stderr, "\nbackfill-claims: %v\n", err)
		os.Exit(exitFailed)
	}
}

func run(cfg config) error {
	if err := validate(cfg); err != nil {
		return err
	}

	db, err := open(cfg.dbPath)
	if err != nil {
		return err
	}
	defer db.Close()

	switch {
	case cfg.revert != "":
		return runRevert(db, cfg.revert)
	case cfg.check:
		return runCheck(db, cfg.dbPath)
	default:
		return runBackfill(db, cfg.dbPath, cfg.apply, cfg.backupDir)
	}
}

// validate rejects the flag combinations that would otherwise resolve silently
// to one of them. -check is read-only by definition, so pairing it with a mode
// that writes is a mistake about what the run is for, not a preference to
// resolve by precedence.
//
// Pure: same inputs, same output, no I/O.
func validate(cfg config) error {
	if cfg.check && cfg.apply {
		return errors.New("-check never writes; drop one of -check / -apply")
	}
	if cfg.check && cfg.revert != "" {
		return errors.New("-check never writes; drop one of -check / -revert")
	}
	return nil
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

// --- Check ------------------------------------------------------------------

// runCheck answers one question — is any winning round missing its claim? — and
// answers it without minting an id, a code or a transaction. It deliberately
// does NOT build the plan the backfill would: building one calls id.New, and a
// detector that generates the thing it is detecting the absence of is a detector
// nobody trusts to run against production.
func runCheck(db *sql.DB, dbPath string) error {
	wins, err := readUnclaimedWins(db)
	if err != nil {
		return err
	}
	awards, err := readAwards(db)
	if err != nil {
		return err
	}

	repairable, orphaned := partitionWins(wins, awards)
	fmt.Print(checkReport(dbPath, repairable, orphaned))

	if len(repairable) == 0 {
		return nil
	}
	return fmt.Errorf("%d %w — see above", len(repairable), errNeedsRepair)
}

// checkReport renders the whole verdict as a string, so the exact words are
// assertable without capturing stdout.
//
// ORPHANED WINS DO NOT FAIL THE CHECK, and that is the one judgement call in
// this file. A win whose award was deleted can never be given a claim —
// award_name is a snapshot and there is no name left to snapshot (see
// partitionWins) — so failing on it would pin the check red permanently, with
// no run that could ever clear it. A permanently red check is silenced within a
// week and then detects nothing at all, including the repairable case this
// exists for. They are reported loudly instead, every run, because they are
// still data loss; they are just not data loss this script can undo. Soft-delete
// for awards is what would make them repairable, and only then should they
// count towards the exit code.
//
// Pure: same inputs, same output, no I/O.
func checkReport(dbPath string, repairable, orphaned []win) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Database: %s\n\n", dbPath)

	if len(repairable) == 0 && len(orphaned) == 0 {
		b.WriteString("OK — every winning round has a claim.\n")
		return b.String()
	}

	if len(repairable) > 0 {
		fmt.Fprintf(&b, "%d winning round(s) have NO claim and can be repaired:\n", len(repairable))
		for _, w := range repairable {
			fmt.Fprintf(&b, "  score %-12s  game %-16s  award %-12s  %s\n",
				w.ScoreID, w.GameSlug, w.AwardID, w.CreatedAt.Format(time.RFC3339))
		}
		fmt.Fprintf(&b, "\nRepair with:  go run ./cmd/backfill-claims -db %s -apply\n", dbPath)
		b.WriteString("Note a round older than the claim window reconstructs to an already-expired\n")
		b.WriteString("claim. That is correct, and a row the counter can look up still beats none.\n")
	}

	if len(orphaned) > 0 {
		if len(repairable) > 0 {
			b.WriteString("\n")
		}
		fmt.Fprintf(&b, "%d winning round(s) have NO claim and can NEVER be given one — the award\n", len(orphaned))
		b.WriteString("was deleted, so there is no name left to snapshot:\n")
		for _, w := range orphaned {
			fmt.Fprintf(&b, "  score %-12s  game %-16s  award %s (deleted)\n", w.ScoreID, w.GameSlug, w.AwardID)
		}
		b.WriteString("These do NOT fail the check: no run can clear them, and a check that stays\n")
		b.WriteString("red forever gets silenced. They are permanent, and they are why award\n")
		b.WriteString("soft-delete matters.\n")
	}
	return b.String()
}

// --- Backfill ---------------------------------------------------------------

func runBackfill(db *sql.DB, dbPath string, apply bool, backupDir string) error {
	wins, err := readUnclaimedWins(db)
	if err != nil {
		return err
	}
	awards, err := readAwards(db)
	if err != nil {
		return err
	}
	ttlHours, err := readTTLHours(db)
	if err != nil {
		return err
	}
	ttl := claim.TTL(ttlHours)

	claimable, orphaned := partitionWins(wins, awards)

	fmt.Printf("Database: %s\n", dbPath)
	fmt.Printf("Claim window: %s\n\n", describeTTL(ttlHours))

	plan, err := buildClaims(db, claimable, awards, ttl)
	if err != nil {
		return err
	}
	report(plan, orphaned, time.Now())

	if len(plan) == 0 {
		fmt.Println("Nothing to backfill — every winning round already has a claim.")
		return nil
	}
	if !apply {
		fmt.Printf("\nDRY RUN — no changes written. Re-run with -apply to issue these %d claim(s).\n", len(plan))
		return nil
	}

	path, err := writeBackup(plan, dbPath, backupDir)
	if err != nil {
		return fmt.Errorf("write backup: %w", err)
	}
	fmt.Printf("\nBackup written to %s\n", path)

	if err := insertClaims(db, plan); err != nil {
		return fmt.Errorf("apply (rolled back, database unchanged): %w", err)
	}
	fmt.Printf("Issued %d claim(s).\n", len(plan))
	fmt.Printf("To undo: go run ./cmd/backfill-claims -db %s -revert %s\n", dbPath, path)
	return nil
}

// partitionWins splits the unclaimed wins into those that can be given a claim
// and those that cannot.
//
// A win is orphaned when the award it names is gone. There is nothing to write
// for one: award_name is a SNAPSHOT (see 003_claims.sql), and a deleted award
// leaves no name to snapshot — inventing "unknown prize" would put a lie in the
// one column designed to outlive the award. The service already degrades such a
// round to "no prize" on read, so the honest outcome is to report it and leave
// it alone.
//
// Pure: same inputs, same output, no I/O.
func partitionWins(wins []win, awards map[string]domain.Award) (claimable, orphaned []win) {
	for _, w := range wins {
		if _, ok := awards[w.AwardID]; ok {
			claimable = append(claimable, w)
			continue
		}
		orphaned = append(orphaned, w)
	}
	return claimable, orphaned
}

// buildClaims mints an id and a code for each claimable win and reconstructs
// the claim through the live calculation.
//
// The codes are checked against the ones already in the database and the ones
// minted earlier in this same run: the column is UNIQUE, so a collision is a
// failed insert rather than a silent overwrite, but failing halfway through a
// batch is worse than not colliding in the first place.
func buildClaims(db *sql.DB, wins []win, awards map[string]domain.Award, ttl time.Duration) ([]domain.Claim, error) {
	takenCodes, err := readTakenCodes(db)
	if err != nil {
		return nil, err
	}
	takenIDs, err := readTakenClaimIDs(db)
	if err != nil {
		return nil, err
	}

	out := make([]domain.Claim, 0, len(wins))
	for _, w := range wins {
		claimID, err := mintUnique(takenIDs, id.New)
		if err != nil {
			return nil, fmt.Errorf("mint claim id: %w", err)
		}
		code, err := mintUnique(takenCodes, id.NewClaimCode)
		if err != nil {
			return nil, fmt.Errorf("mint claim code: %w", err)
		}
		// A partial ScoreEntry: Issue reads only the id and the timestamp off
		// it, and reading the whole row to hand over two fields would be a
		// second query per win for nothing.
		score := domain.ScoreEntry{ID: w.ScoreID, CreatedAt: w.CreatedAt}
		out = append(out, claim.Issue(claimID, code, score, awards[w.AwardID], ttl))
	}
	return out, nil
}

func mintUnique(taken map[string]bool, mint func() string) (string, error) {
	for attempt := 0; attempt < 100; attempt++ {
		candidate := mint()
		if !taken[candidate] {
			taken[candidate] = true
			return candidate, nil
		}
	}
	return "", fmt.Errorf("no unique value after 100 attempts")
}

// report prints the plan. `now` is a parameter so the expiry count describes
// the moment the run is being judged at rather than reading the clock twice.
func report(plan []domain.Claim, orphaned []win, now time.Time) {
	if len(plan) > 0 {
		fmt.Println("Claims to issue:")
		for _, c := range plan {
			fmt.Printf("  score %-12s  code %-12s  %-24s  %s\n",
				c.ScoreID, c.Code, truncate(c.AwardName, 24), claim.StatusAt(c, now))
		}
	}

	// Stated as a count of what the operator would otherwise have to notice
	// themselves: a claim reconstructed onto a round older than the window is
	// born expired, which is correct and is not what anyone expects to read.
	expired := 0
	for _, c := range plan {
		if claim.StatusAt(c, now) == domain.ClaimExpired {
			expired++
		}
	}
	if expired > 0 {
		fmt.Printf("\n  %d of these are already past their window: the round is older than the\n", expired)
		fmt.Printf("  claim TTL, so the reconstructed claim expires the moment it exists. It is\n")
		fmt.Printf("  still a record the counter can look up; it is not a collectable prize.\n")
	}

	if len(orphaned) > 0 {
		fmt.Printf("\nSkipped %d win(s) whose award no longer exists — there is no name to\n", len(orphaned))
		fmt.Printf("snapshot, and award_name must not be invented:\n")
		for _, w := range orphaned {
			fmt.Printf("  score %-12s  game %-16s  award %s (deleted)\n", w.ScoreID, w.GameSlug, w.AwardID)
		}
	}
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n-1] + "…"
}

func describeTTL(hours int) string {
	if hours <= 0 {
		return "never expires (claim_ttl_hours is 0 or unset)"
	}
	return fmt.Sprintf("%dh from the round", hours)
}

// insertClaims writes every claim in ONE transaction, so a failure halfway
// through leaves the database exactly as it was rather than half-repaired.
//
// The timestamps are formatted the way internal/storage/sqlite does it —
// RFC3339Nano in UTC, see that package's time.go. The convention is duplicated
// here because those helpers are unexported; main_test.go round-trips a written
// row back through the real store, so the two cannot drift apart unnoticed.
func insertClaims(db *sql.DB, plan []domain.Claim) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback() //nolint:errcheck // no-op once committed

	for _, c := range plan {
		if _, err := tx.Exec(`
			INSERT INTO claims (id, code, score_id, award_id, award_name, award_name_th, issued_at, expires_at, redeemed_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
			c.ID, c.Code, c.ScoreID, c.AwardID, c.AwardName, c.AwardNameTH,
			sqlTime(c.IssuedAt), sqlOptionalTime(c.ExpiresAt),
		); err != nil {
			return fmt.Errorf("insert claim for score %s: %w", c.ScoreID, err)
		}
		fmt.Printf("  issued %s for score %s (%s)\n", c.Code, c.ScoreID, c.AwardName)
	}
	return tx.Commit()
}

func sqlTime(t time.Time) string { return t.UTC().Format(time.RFC3339Nano) }

// sqlOptionalTime maps a ZERO time to NULL, which is how the claims table
// spells "never expires".
func sqlOptionalTime(t time.Time) any {
	if t.IsZero() {
		return nil
	}
	return sqlTime(t)
}

// --- Reads ------------------------------------------------------------------

// readUnclaimedWins lists the rounds that won a prize and have no claim.
//
// The LEFT JOIN is what makes a re-run a no-op: a score that got its claim on
// an earlier pass simply is not returned. Ordered oldest first so the report
// reads as a history.
func readUnclaimedWins(db *sql.DB) ([]win, error) {
	rows, err := db.Query(`
		SELECT s.id, s.game_slug, s.player_name, s.award_id, s.created_at
		FROM scores s
		LEFT JOIN claims c ON c.score_id = s.id
		WHERE s.award_id IS NOT NULL AND s.award_id <> '' AND c.id IS NULL
		ORDER BY s.created_at`)
	if err != nil {
		return nil, fmt.Errorf("read unclaimed wins: %w", err)
	}
	defer rows.Close()

	var out []win
	for rows.Next() {
		var w win
		var createdAt string
		if err := rows.Scan(&w.ScoreID, &w.GameSlug, &w.PlayerName, &w.AwardID, &createdAt); err != nil {
			return nil, fmt.Errorf("scan win: %w", err)
		}
		t, err := time.Parse(time.RFC3339Nano, createdAt)
		if err != nil {
			return nil, fmt.Errorf("score %s has an unreadable created_at %q: %w", w.ScoreID, createdAt, err)
		}
		w.CreatedAt = t.UTC()
		out = append(out, w)
	}
	return out, rows.Err()
}

// readAwards indexes the awards by id, carrying only the two fields a claim
// snapshots. A deleted award is simply absent — see partitionWins.
func readAwards(db *sql.DB) (map[string]domain.Award, error) {
	rows, err := db.Query(`SELECT id, name, COALESCE(name_th, '') FROM awards`)
	if err != nil {
		return nil, fmt.Errorf("read awards: %w", err)
	}
	defer rows.Close()

	out := map[string]domain.Award{}
	for rows.Next() {
		var a domain.Award
		if err := rows.Scan(&a.ID, &a.Name, &a.NameTH); err != nil {
			return nil, fmt.Errorf("scan award: %w", err)
		}
		out[a.ID] = a
	}
	return out, rows.Err()
}

// readTTLHours reads the configured claim window, falling back exactly as the
// service does: a missing or unparseable value means the default, because a
// knob nobody set must not shorten a prize's life.
func readTTLHours(db *sql.DB) (int, error) {
	var raw string
	err := db.QueryRow(`SELECT value FROM settings WHERE key = ?`, domain.SettingClaimTTLHours).Scan(&raw)
	if err == sql.ErrNoRows {
		return domain.DefaultClaimTTLHours, nil
	}
	if err != nil {
		return 0, fmt.Errorf("read %s: %w", domain.SettingClaimTTLHours, err)
	}
	var hours int
	if _, err := fmt.Sscanf(raw, "%d", &hours); err != nil {
		return domain.DefaultClaimTTLHours, nil
	}
	return hours, nil
}

func readTakenCodes(db *sql.DB) (map[string]bool, error) {
	return readColumn(db, `SELECT code FROM claims`)
}

func readTakenClaimIDs(db *sql.DB) (map[string]bool, error) {
	return readColumn(db, `SELECT id FROM claims`)
}

func readColumn(db *sql.DB, query string) (map[string]bool, error) {
	rows, err := db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("read: %w", err)
	}
	defer rows.Close()

	out := map[string]bool{}
	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil {
			return nil, err
		}
		out[v] = true
	}
	return out, rows.Err()
}

// --- Backup and revert ------------------------------------------------------

func writeBackup(plan []domain.Claim, dbPath, dir string) (string, error) {
	if dir == "" {
		dir = filepath.Join(filepath.Dir(dbPath), "backups")
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	stamp := time.Now().UTC().Format("20060102T150405Z")
	path := filepath.Join(dir, fmt.Sprintf("backfill-claims-%s.json", stamp))

	body, err := json.MarshalIndent(backup{
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
		Database:  dbPath,
		Claims:    plan,
	}, "", "  ")
	if err != nil {
		return "", err
	}
	return path, os.WriteFile(path, body, 0o644)
}

// runRevert deletes the claims recorded in a backup file.
//
// It REFUSES to delete a claim that has since been redeemed, and this is the
// most important rule in the file. Undoing a backfill is a correction to a
// script's output; a redeemed claim is a record that a prize was handed to a
// person. Deleting that would erase the evidence of a transaction to tidy up a
// mistake that has already been overtaken by events — the same failure the
// roadmap notes about un-redeeming erasing its own evidence, except here it
// would be irreversible.
//
// Deleting by id, never by score, so a claim issued by the live path after this
// backup was taken cannot be caught by the undo.
func runRevert(db *sql.DB, path string) error {
	body, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read backup: %w", err)
	}
	var b backup
	if err := json.Unmarshal(body, &b); err != nil {
		return fmt.Errorf("parse backup: %w", err)
	}

	fmt.Printf("Reverting %d claim(s) from %s (taken %s)\n\n", len(b.Claims), path, b.CreatedAt)

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback() //nolint:errcheck // no-op once committed

	deleted, kept := 0, 0
	for _, c := range b.Claims {
		res, err := tx.Exec(`DELETE FROM claims WHERE id = ? AND redeemed_at IS NULL`, c.ID)
		if err != nil {
			return fmt.Errorf("revert (rolled back, database unchanged) %s: %w", c.ID, err)
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			// Either already gone (a re-run of the undo) or redeemed. The second
			// is the one worth naming, so say which.
			if redeemed, err := isRedeemed(tx, c.ID); err == nil && redeemed {
				fmt.Printf("  KEPT    %s — redeemed since the backfill; the prize was handed over\n", c.Code)
				kept++
				continue
			}
			fmt.Printf("  absent  %s — nothing to delete\n", c.Code)
			continue
		}
		fmt.Printf("  deleted %s (score %s)\n", c.Code, c.ScoreID)
		deleted++
	}
	if err := tx.Commit(); err != nil {
		return err
	}

	fmt.Printf("\nDeleted %d claim(s).", deleted)
	if kept > 0 {
		fmt.Printf(" Kept %d that had been redeemed.", kept)
	}
	fmt.Println()
	return nil
}

func isRedeemed(tx *sql.Tx, claimID string) (bool, error) {
	var redeemedAt sql.NullString
	err := tx.QueryRow(`SELECT redeemed_at FROM claims WHERE id = ?`, claimID).Scan(&redeemedAt)
	if err != nil {
		return false, err
	}
	return redeemedAt.Valid, nil
}
