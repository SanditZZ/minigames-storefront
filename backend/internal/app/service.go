// Package app is the ACTION layer that orchestrates a use case end to end: it
// reads/writes the store and calls the pure calculation packages (game, reward)
// but contains no business rules of its own. HTTP handlers stay thin by
// delegating here; this service could equally be driven by a CLI or a queue.
package app

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/big"
	"strconv"
	"time"

	"github.com/google/uuid"

	"github.com/sanditzz/minigames-storefront/backend/internal/claim"
	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
	"github.com/sanditzz/minigames-storefront/backend/internal/game"
	"github.com/sanditzz/minigames-storefront/backend/internal/i18n"
	"github.com/sanditzz/minigames-storefront/backend/internal/id"
	"github.com/sanditzz/minigames-storefront/backend/internal/reward"
	"github.com/sanditzz/minigames-storefront/backend/internal/settings"
	"github.com/sanditzz/minigames-storefront/backend/internal/storage"
)

// Clock is injected so time-dependent actions stay testable. Production uses
// time.Now; tests can supply a fixed clock.
type Clock func() time.Time

// Service wires the store and the game registry together.
type Service struct {
	store    storage.Store
	registry *game.Registry
	now      Clock
}

// New builds a Service. If now is nil, time.Now is used.
func New(store storage.Store, registry *game.Registry, now Clock) *Service {
	if now == nil {
		now = time.Now
	}
	return &Service{store: store, registry: registry, now: now}
}

// Registry exposes the game catalog (read-only) to callers such as handlers.
func (s *Service) Registry() *game.Registry { return s.registry }

// Store exposes the underlying store for admin CRUD handlers.
func (s *Service) Store() storage.Store { return s.store }

// --- Catalog ---------------------------------------------------------------

// ListGames returns the playable catalog with any admin benchmark override
// applied.
//
// Handlers go through here rather than reading Registry() directly: the
// registry is what the CODE says a game is, and what a player is served is that
// plus what the operator has retuned. Reading the registry straight would have
// been the quiet way to serve a stale benchmark from one endpoint while another
// served the tuned one.
func (s *Service) ListGames(ctx context.Context) []domain.Game {
	return settings.ApplyTargetScores(s.registry.Enabled(), s.allSettings(ctx))
}

// GetGame returns one game with its override applied, or ErrGameUnavailable.
func (s *Service) GetGame(ctx context.Context, slug domain.GameSlug) (domain.Game, error) {
	def, ok := s.registry.Get(slug)
	if !ok {
		return domain.Game{}, ErrGameUnavailable
	}
	return settings.ApplyTargetScore(def.Game, s.allSettings(ctx)), nil
}

// allSettings reads every setting, tolerating failure: an override is a tuning
// knob, and a store whose settings table is briefly unreadable should serve the
// catalog benchmark rather than no games at all.
func (s *Service) allSettings(ctx context.Context) []domain.Setting {
	all, err := s.store.Settings().List(ctx)
	if err != nil {
		return nil
	}
	return all
}

// --- Session ---------------------------------------------------------------

// StartSession issues a single-use permit for a game round. The server owns the
// clock and TTL, so the client cannot lie about when its round began.
//
// It returns the whole Definition rather than just its Game because a
// server-scored game also has to hand the client the round's Challenge, and
// which games have one is a property of the catalog, not of the session.
//
// The challenge is minted HERE rather than in the handler that serves it, because
// it has to be stored: a Scorer replays the round against the challenge that was
// actually issued, and a challenge carrying a random draw (Precision Stop's
// marker phase) cannot be recovered any other way. See domain.Session.Challenge.
func (s *Service) StartSession(ctx context.Context, slug domain.GameSlug) (domain.Session, game.Definition, error) {
	def, ok := s.registry.Get(slug)
	if !ok || !def.Game.Enabled {
		return domain.Session{}, game.Definition{}, ErrGameUnavailable
	}
	challenge, err := challengeJSON(def)
	if err != nil {
		return domain.Session{}, game.Definition{}, err
	}
	ttl := time.Duration(s.settingInt(ctx, domain.SettingSessionTTLSeconds, 120)) * time.Second
	now := s.now()
	sess := domain.Session{
		// Deliberately NOT internal/id: a token is a credential rather than a
		// name for something, so it keeps UUIDv4's 122 bits. See id.TokenLengthNote.
		Token:     uuid.NewString(),
		GameSlug:  slug,
		IssuedAt:  now,
		ExpiresAt: now.Add(ttl),
		Challenge: challenge,
	}
	if err := s.store.Sessions().Create(ctx, sess); err != nil {
		return domain.Session{}, game.Definition{}, err
	}
	return sess, def, nil
}

// challengeJSON builds and serialises a round's challenge, or "" for a game that
// needs none.
//
// This is the ACTION half of the split: game.Challenge is pure and takes its
// randomness as a parameter, and this is the one place a real random source is
// handed to it. crypto/rand rather than math/rand because the draw is what stops
// a player predicting the sweep they are about to be scored against — a
// predictable phase would hand back exactly the advantage moving the draw
// server-side was meant to remove.
func challengeJSON(def game.Definition) (string, error) {
	if def.Challenge == nil {
		return "", nil
	}
	raw, err := json.Marshal(def.Challenge(cryptoDraw))
	if err != nil {
		return "", fmt.Errorf("build challenge for %s: %w", def.Game.Slug, err)
	}
	return string(raw), nil
}

// cryptoDraw is a game.Draw over crypto/rand. It degrades to 0 rather than
// failing a round if the system's entropy source errors — a fixed phase is a
// weaker game, but refusing to issue sessions because of it would take the
// storefront down for a condition that does not happen on a working machine.
func cryptoDraw(n int) int {
	if n <= 0 {
		return 0
	}
	v, err := rand.Int(rand.Reader, big.NewInt(int64(n)))
	if err != nil {
		return 0
	}
	return int(v.Int64())
}

// --- Score submission ------------------------------------------------------

// SubmitInput is the client-provided part of a score submission.
//
// Value and Events are the two ways a round reports itself, and a game uses
// exactly one of them — whichever its Definition is written for. For a
// server-scored game Value is not read at all: see scoreOf.
type SubmitInput struct {
	GameSlug   domain.GameSlug
	Token      string
	PlayerName string
	// Value is what the CLIENT thinks it scored. Only games with a Validator
	// use it, and for those it is a claim to be checked, never a fact.
	Value int
	// Events is what the player DID — millisecond offsets from the start of
	// play. Games with a Scorer replay these to derive the score themselves.
	Events []int
}

// ClaimView is a claim plus its status at the moment it was read.
//
// The status travels with the claim rather than being re-derived by each
// caller, because deriving it needs a clock and the service is the layer that
// owns one. A handler computing it would be a second clock; a frontend
// computing it would be a third, on a device whose time the player controls.
type ClaimView struct {
	Claim  domain.Claim       `json:"claim"`
	Status domain.ClaimStatus `json:"status"` // derived, never stored
}

// SubmitResult is the outcome the player sees.
type SubmitResult struct {
	Score domain.ScoreEntry `json:"score"`
	Rank  int               `json:"rank"`            // 1-based position on the leaderboard
	Award *domain.Award     `json:"award,omitempty"` // nil if no prize won
	Claim *ClaimView        `json:"claim,omitempty"` // nil if nothing was won
}

// SubmitScore validates and records a round, then (if the score qualifies)
// reserves and awards the best available prize. The elapsed time used for
// anti-cheat validation is computed server-side from the session, never trusted
// from the client.
func (s *Service) SubmitScore(ctx context.Context, in SubmitInput) (SubmitResult, error) {
	def, ok := s.registry.Get(in.GameSlug)
	if !ok || !def.Game.Enabled {
		return SubmitResult{}, ErrGameUnavailable
	}

	sess, err := s.store.Sessions().Get(ctx, in.Token)
	if err != nil {
		return SubmitResult{}, ErrInvalidSession
	}
	if sess.GameSlug != in.GameSlug {
		return SubmitResult{}, ErrInvalidSession
	}
	now := s.now()
	if now.After(sess.ExpiresAt) {
		return SubmitResult{}, ErrSessionExpired
	}

	// Server-authoritative elapsed time drives the plausibility check.
	elapsedMs := int(now.Sub(sess.IssuedAt).Milliseconds())
	defaults := game.DefaultLimits()
	limits := game.Limits{
		MaxTapsPerSecond: s.settingInt(ctx, domain.SettingMaxTapsPerSecond, defaults.MaxTapsPerSecond),
		MinReactionMs:    s.settingInt(ctx, domain.SettingMinReactionMs, defaults.MinReactionMs),
	}
	value, err := scoreOf(def, in, sess, elapsedMs, limits)
	if err != nil {
		return SubmitResult{}, err
	}

	// Consume the permit atomically; a replay returns conflict and cannot score.
	if _, err := s.store.Sessions().Consume(ctx, in.Token); err != nil {
		return SubmitResult{}, ErrSessionConsumed
	}

	// The prize is reserved BEFORE the score row is written so the winning
	// award id can be persisted on the row itself. That link is what lets the
	// result be re-read later at a stable URL and still report the prize that
	// was actually granted, rather than one re-derived from current stock.
	award, err := s.reserveAward(ctx, def.Game, value)
	if err != nil {
		return SubmitResult{}, err
	}

	entry := domain.ScoreEntry{
		ID:         id.New(),
		GameSlug:   in.GameSlug,
		PlayerName: sanitizeName(in.PlayerName),
		Value:      value,
		AwardID:    awardID(award),
		CreatedAt:  now,
	}
	saved, err := s.store.Scores().Create(ctx, entry)
	if err != nil {
		return SubmitResult{}, err
	}

	rank, err := s.rankOf(ctx, def.Game, saved)
	if err != nil {
		return SubmitResult{}, err
	}

	return SubmitResult{
		Score: saved,
		Rank:  rank,
		Award: award,
		Claim: s.viewClaim(s.issueClaim(ctx, saved, award)),
	}, nil
}

// scoreOf settles what a round was actually worth.
//
// This is where the catalog's two answers to "was this score real?" diverge,
// and the difference is worth being precise about because it is the difference
// between checking a claim and not needing one:
//
//   - A Scorer means the server REPLAYS the round from what the player did.
//     in.Value is never read — a client that sends one is ignored rather than
//     contradicted, because there is nothing to contradict: its opinion of its
//     own score was never part of the protocol.
//   - A Validator means the client scored itself and the server can only judge
//     whether the number is plausible. That is as far as anti-cheat reaches
//     when the server saw none of the round.
//
// A game with neither is taken at its word, deliberately and visibly.
//
// Pure: everything it needs is passed in. The elapsed time is the server's, not
// the client's, and stays that way — a Scorer receives the game's own round
// length rather than the wall-clock gap, because the events it replays are
// offsets from the start of PLAY, and the session has been open since before
// the countdown.
//
// The Scorer is also handed the session's stored challenge, which is the round
// the player was actually given. Regenerating it here instead would work for
// Stack and silently mis-score Precision Stop, whose phase is drawn per round —
// so the rule is that a Scorer reads the challenge from the session or not at
// all.
func scoreOf(def game.Definition, in SubmitInput, sess domain.Session, elapsedMs int, limits game.Limits) (int, error) {
	if def.Scorer != nil {
		value, err := def.Scorer(in.Events, def.Game.DurationMs, []byte(sess.Challenge))
		if err != nil {
			return 0, fmt.Errorf("%w: %v", ErrScoreRejected, err)
		}
		return value, nil
	}
	if def.Validator != nil {
		if err := def.Validator(in.Value, elapsedMs, limits); err != nil {
			return 0, fmt.Errorf("%w: %v", ErrScoreRejected, err)
		}
	}
	return in.Value, nil
}

// ScoreResult re-reads a finished round so a result URL stays addressable
// across reloads and shared links. The rank is recomputed against the live
// leaderboard (it legitimately drifts as others play), while the award comes
// from the id stored on the row — never re-selected — so the prize shown never
// changes after the fact.
func (s *Service) ScoreResult(ctx context.Context, slug domain.GameSlug, scoreID string) (SubmitResult, error) {
	def, ok := s.registry.Get(slug)
	if !ok {
		return SubmitResult{}, ErrGameUnavailable
	}

	entry, err := s.store.Scores().Get(ctx, scoreID)
	if err != nil {
		return SubmitResult{}, err
	}
	// A score belongs to exactly one game; a mismatched slug is a bad URL, not
	// a different view of the same result.
	if entry.GameSlug != slug {
		return SubmitResult{}, storage.ErrNotFound
	}

	rank, err := s.rankOf(ctx, def.Game, entry)
	if err != nil {
		return SubmitResult{}, err
	}

	award, err := s.awardByID(ctx, entry.AwardID)
	if err != nil {
		return SubmitResult{}, err
	}

	// The claim is re-read rather than re-issued: one round earns exactly one
	// claim, and revisiting the URL must show the same code, not mint another.
	existing, err := s.claimForScore(ctx, entry.ID)
	if err != nil {
		return SubmitResult{}, err
	}

	return SubmitResult{Score: entry, Rank: rank, Award: award, Claim: s.viewClaim(existing)}, nil
}

// awardByID resolves a stored award reference for display. An award deleted
// since the round was played is reported as "no prize" rather than an error —
// the score itself is still a valid result.
// The parameter is refID rather than id so it does not shadow the internal/id
// package, which this file now depends on for minting score ids.
func (s *Service) awardByID(ctx context.Context, refID string) (*domain.Award, error) {
	if refID == "" {
		return nil, nil
	}
	a, err := s.store.Awards().Get(ctx, refID)
	if errors.Is(err, storage.ErrNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// --- Claims ----------------------------------------------------------------

// claimCodeAttempts caps the retry loop for a colliding claim code. Each draw
// is independent from ~39 bits, so needing a sixth is not "unlucky" — it is
// evidence something else is wrong (a stuck CSPRNG, a corrupted alphabet), and
// looping harder would hide it.
const claimCodeAttempts = 5

// issueClaim mints the redeemable credential for a winning round.
//
// It returns nil — WITHOUT failing the submission — when there is nothing to
// claim, and also when the claim cannot be written. That second case is a
// deliberate asymmetry, and it is the interesting one: by the time this runs,
// the score row is committed and the award's stock is already decremented.
// Failing the request would tell the player their round did not count when it
// did, and would not give the stock back. A win recorded without a code is a
// degraded outcome an admin can repair from the score row; a round that
// silently ate a prize and reported an error is not.
//
// The failure is logged rather than swallowed, because "some winners have no
// claim" is invisible from the outside otherwise.
func (s *Service) issueClaim(ctx context.Context, score domain.ScoreEntry, award *domain.Award) *domain.Claim {
	if award == nil {
		return nil
	}
	ttl := claim.TTL(s.settingInt(ctx, domain.SettingClaimTTLHours, domain.DefaultClaimTTLHours))

	for attempt := 0; attempt < claimCodeAttempts; attempt++ {
		fresh := claim.Issue(id.New(), id.NewClaimCode(), score, *award, ttl)
		saved, err := s.store.Claims().Create(ctx, fresh)
		if err == nil {
			return &saved
		}
		if errors.Is(err, storage.ErrConflict) {
			continue // the code was taken; the UNIQUE constraint did its job
		}
		log.Printf("claim: could not issue for score %s: %v", score.ID, err)
		return nil
	}
	log.Printf("claim: %d code collisions in a row for score %s — check the generator", claimCodeAttempts, score.ID)
	return nil
}

// claimForScore reads the claim a round earned. A round with no claim is not an
// error: most rounds win nothing, and a win from before claims existed (or one
// whose issue failed) legitimately has none.
func (s *Service) claimForScore(ctx context.Context, scoreID string) (*domain.Claim, error) {
	c, err := s.store.Claims().GetByScore(ctx, scoreID)
	if errors.Is(err, storage.ErrNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// viewClaim attaches the derived status, reading the clock once.
func (s *Service) viewClaim(c *domain.Claim) *ClaimView {
	if c == nil {
		return nil
	}
	v := ClaimView{Claim: *c, Status: claim.StatusAt(*c, s.now())}
	return &v
}

// ListClaims returns every claim, newest first, optionally narrowed to one
// status. The filtering is a calculation over the rows rather than a WHERE
// clause — see the note on storage.ClaimRepository for why it has to be.
func (s *Service) ListClaims(ctx context.Context, status domain.ClaimStatus) ([]ClaimView, error) {
	all, err := s.store.Claims().List(ctx)
	if err != nil {
		return nil, err
	}
	now := s.now()
	matching := claim.Filter(all, status, now)

	out := make([]ClaimView, 0, len(matching))
	for _, c := range matching {
		out = append(out, ClaimView{Claim: c, Status: claim.StatusAt(c, now)})
	}
	return out, nil
}

// GetClaim resolves a code WITHOUT acting on it.
//
// This is what makes a confirmation step possible: "Redeem Free Coffee for
// ABCD-2345?" needs the prize's name, and the code alone does not carry it. A
// UI that skipped this would have to either name nothing (confirming a bare
// string tells an operator nothing about what they are about to hand over) or
// redeem first and describe afterwards, which is the mis-scan this whole path
// exists to prevent.
//
// It reports every failure the way RedeemClaim does — one ErrClaimNotFound for
// both an impossible shape and an unknown code — so adding a lookup does not
// hand a code-guesser a cheaper oracle than the redeem endpoint already was.
func (s *Service) GetClaim(ctx context.Context, code string) (ClaimView, error) {
	found, err := s.claimByCode(ctx, code)
	if err != nil {
		return ClaimView{}, err
	}
	return ClaimView{Claim: found, Status: claim.StatusAt(found, s.now())}, nil
}

// claimByCode normalizes, shape-checks and loads a claim. Shared by every
// code-addressed operation so they cannot drift on what a code is or on how
// much a failure reveals.
func (s *Service) claimByCode(ctx context.Context, code string) (domain.Claim, error) {
	normalized := id.NormalizeClaimCode(code)
	if !id.LooksLikeClaimCode(normalized) {
		return domain.Claim{}, ErrClaimNotFound
	}

	found, err := s.store.Claims().GetByCode(ctx, normalized)
	if errors.Is(err, storage.ErrNotFound) {
		return domain.Claim{}, ErrClaimNotFound
	}
	if err != nil {
		return domain.Claim{}, err
	}
	return found, nil
}

// UnredeemClaim takes a redemption back: the inverse of RedeemClaim.
//
// It exists because redeeming had no inverse and scanning makes the trigger far
// easier to pull — a camera pointed at the wrong screen redeems a stranger's
// prize, and until now the only repair was editing SQLite by hand.
//
// Note what it deliberately does NOT do: it does not extend the claim's window.
// An un-redeemed claim whose expiry has passed comes back as expired, not
// issued, because the deadline is a fact about when the round was won rather
// than about this correction. claim.StatusAfterUnredeem is what lets a UI warn
// about that before the operator commits.
func (s *Service) UnredeemClaim(ctx context.Context, code string) (ClaimView, error) {
	found, err := s.claimByCode(ctx, code)
	if err != nil {
		return ClaimView{}, err
	}

	if ok, reason := claim.CanUnredeem(found); !ok {
		// The claim rides along with the refusal, same as RedeemClaim: the admin
		// still needs to see what they were looking at.
		return ClaimView{Claim: found, Status: claim.StatusAt(found, s.now())},
			fmt.Errorf("%w: %s", ErrClaimNotUnredeemable, reason)
	}

	restored, err := s.store.Claims().Unredeem(ctx, found.Code)
	if errors.Is(err, storage.ErrConflict) {
		// Another counter un-redeemed it between the check and the write.
		return ClaimView{}, fmt.Errorf("%w: %s", ErrClaimNotUnredeemable, claim.ReasonNotRedeemed)
	}
	if err != nil {
		return ClaimView{}, err
	}
	return ClaimView{Claim: restored, Status: claim.StatusAt(restored, s.now())}, nil
}

// RedeemClaim hands a prize over: it marks the code used, once.
//
// The code arrives as a human typed it — lowercase, grouped with a dash,
// padded with spaces — so it is normalized before anything else looks at it.
// A code that could not exist is rejected without touching the database.
//
// The check-then-write is not a race: claim.CanRedeem answers "is this legal",
// and the store's conditional UPDATE is what makes "redeem exactly once" true
// when two admins scan the same code at the same moment.
func (s *Service) RedeemClaim(ctx context.Context, code string) (ClaimView, error) {
	found, err := s.claimByCode(ctx, code)
	if err != nil {
		return ClaimView{}, err
	}

	now := s.now()
	if ok, reason := claim.CanRedeem(found, now); !ok {
		// The claim is returned alongside the error: an admin refused at the
		// counter still needs to see what the prize was and when it lapsed.
		return ClaimView{Claim: found, Status: claim.StatusAt(found, now)},
			fmt.Errorf("%w: %s", ErrClaimNotRedeemable, reason)
	}

	redeemed, err := s.store.Claims().Redeem(ctx, found.Code, now)
	if errors.Is(err, storage.ErrConflict) {
		// Lost the race with another counter between the check and the write.
		return ClaimView{}, fmt.Errorf("%w: %s", ErrClaimNotRedeemable, claim.ReasonAlreadyRedeemed)
	}
	if err != nil {
		return ClaimView{}, err
	}
	return ClaimView{Claim: redeemed, Status: claim.StatusAt(redeemed, s.now())}, nil
}

// awardID flattens an optional award to the id persisted on a score row.
func awardID(a *domain.Award) string {
	if a == nil {
		return ""
	}
	return a.ID
}

// reserveAward selects the best eligible prize and atomically decrements its
// stock. If the winning award sells out in a race, it retries with that award
// removed until one is reserved or none remain. Pure selection lives in the
// reward package; only the reservation (a side effect) is here.
func (s *Service) reserveAward(ctx context.Context, g domain.Game, score int) (*domain.Award, error) {
	awards, err := s.store.Awards().List(ctx)
	if err != nil {
		return nil, err
	}
	for {
		winner, ok := reward.Select(awards, g.Slug, score, g.Direction)
		if !ok {
			return nil, nil
		}
		err := s.store.Awards().DecrementStock(ctx, winner.ID)
		if err == nil {
			won := winner
			return &won, nil
		}
		if err == storage.ErrConflict {
			awards = removeAward(awards, winner.ID) // sold out; try the next-best
			continue
		}
		return nil, err
	}
}

// rankOf returns the 1-based leaderboard position of a freshly saved score.
func (s *Service) rankOf(ctx context.Context, g domain.Game, e domain.ScoreEntry) (int, error) {
	top, err := s.store.Scores().Top(ctx, g.Slug, g.Direction, 1000)
	if err != nil {
		return 0, err
	}
	for i, t := range top {
		if t.ID == e.ID {
			return i + 1, nil
		}
	}
	return len(top), nil
}

// HighScores returns the leaderboard for a game, ordered by its direction.
func (s *Service) HighScores(ctx context.Context, slug domain.GameSlug, limit int) ([]domain.ScoreEntry, domain.Game, error) {
	def, ok := s.registry.Get(slug)
	if !ok {
		return nil, domain.Game{}, ErrGameUnavailable
	}
	if limit <= 0 {
		limit = s.settingInt(ctx, domain.SettingHighScoreLimit, 10)
	}
	scores, err := s.store.Scores().Top(ctx, slug, def.Game.Direction, limit)
	// The leaderboard response carries the game, and the client reads the
	// benchmark off it — so it has to be the tuned one here too, or the reveal
	// would scale differently depending on which endpoint the page happened to
	// read the game from.
	return scores, settings.ApplyTargetScore(def.Game, s.allSettings(ctx)), err
}

// Prizes lists what a game is currently offering, in the trimmed public shape.
// It exists so the landing screen can advertise prizes without the player app
// needing an admin token — the filtering and ordering are the reward package's
// pure Showcase calculation, so this only fetches and delegates.
//
// The locale is a parameter rather than something read here because the service
// does not know who is asking — the transport edge negotiates it and passes it
// down, exactly as it does for every message this API words itself.
func (s *Service) Prizes(ctx context.Context, slug domain.GameSlug, loc i18n.Locale) ([]reward.PublicAward, error) {
	def, ok := s.registry.Get(slug)
	if !ok {
		return nil, ErrGameUnavailable
	}
	awards, err := s.store.Awards().List(ctx)
	if err != nil {
		return nil, err
	}
	return reward.Showcase(awards, slug, def.Game.Direction, loc), nil
}

// AllPrizes lists every enabled game's prizes from one reading of the awards
// table, for the landing screen's showcase.
//
// This is the batched form of Prizes, and it is the one the landing screen
// uses: that screen advertises the whole catalog before the player has chosen
// anything, so asking per game cost one request AND one full awards scan per
// game — a page that got measurably slower with every game added. Prizes stays
// for the single-game read, which is a different question.
//
// The catalog comes from the registry rather than ListGames because a prize
// does not depend on a benchmark: reading the settings table here would be a
// second query bought for a field this response does not carry.
func (s *Service) AllPrizes(ctx context.Context, loc i18n.Locale) ([]reward.GamePrizes, error) {
	awards, err := s.store.Awards().List(ctx)
	if err != nil {
		return nil, err
	}
	return reward.ShowcaseAll(awards, s.registry.Enabled(), loc), nil
}

// settingInt reads an int setting, falling back to def on any miss/parse error.
func (s *Service) settingInt(ctx context.Context, key string, def int) int {
	set, err := s.store.Settings().Get(ctx, key)
	if err != nil {
		return def
	}
	n, err := strconv.Atoi(set.Value)
	if err != nil {
		return def
	}
	return n
}

func removeAward(awards []domain.Award, id string) []domain.Award {
	out := awards[:0]
	for _, a := range awards {
		if a.ID != id {
			out = append(out, a)
		}
	}
	return out
}

func sanitizeName(name string) string {
	if name == "" {
		return "Guest"
	}
	if len(name) > 40 {
		return name[:40]
	}
	return name
}
