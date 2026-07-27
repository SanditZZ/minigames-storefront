package app

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
	"github.com/sanditzz/minigames-storefront/backend/internal/game"
	"github.com/sanditzz/minigames-storefront/backend/internal/id"
	"github.com/sanditzz/minigames-storefront/backend/internal/storage"
)

// --- test double ------------------------------------------------------------

// memStore is an in-memory storage.Store used to exercise the service without a
// database. Only the behaviours the service relies on are modelled.
type memStore struct {
	scores   *memScores
	sessions *memSessions
	awards   *memAwards
	claims   *memClaims
	settings *memSettings
}

func newMemStore() *memStore {
	return &memStore{
		scores:   &memScores{byID: map[string]domain.ScoreEntry{}},
		sessions: &memSessions{byToken: map[string]domain.Session{}},
		awards:   &memAwards{byID: map[string]domain.Award{}},
		claims:   &memClaims{byCode: map[string]domain.Claim{}},
		settings: &memSettings{},
	}
}

func (m *memStore) Games() storage.GameRepository       { return nil }
func (m *memStore) Sessions() storage.SessionRepository { return m.sessions }
func (m *memStore) Scores() storage.ScoreRepository     { return m.scores }
func (m *memStore) Awards() storage.AwardRepository     { return m.awards }
func (m *memStore) Claims() storage.ClaimRepository     { return m.claims }
func (m *memStore) Settings() storage.SettingRepository { return m.settings }
func (m *memStore) Migrate(context.Context) error       { return nil }
func (m *memStore) Close() error                        { return nil }

type memScores struct {
	byID  map[string]domain.ScoreEntry
	order []string // insertion order, used to break ties like the SQL ORDER BY
}

func (s *memScores) Create(_ context.Context, e domain.ScoreEntry) (domain.ScoreEntry, error) {
	s.byID[e.ID] = e
	s.order = append(s.order, e.ID)
	return e, nil
}

func (s *memScores) Get(_ context.Context, id string) (domain.ScoreEntry, error) {
	e, ok := s.byID[id]
	if !ok {
		return domain.ScoreEntry{}, storage.ErrNotFound
	}
	return e, nil
}

func (s *memScores) Top(_ context.Context, slug domain.GameSlug, dir domain.ScoreDirection, limit int) ([]domain.ScoreEntry, error) {
	var out []domain.ScoreEntry
	for _, id := range s.order {
		if e := s.byID[id]; e.GameSlug == slug {
			out = append(out, e)
		}
	}
	// insertion sort by direction, stable so earlier entries win ties
	for i := 1; i < len(out); i++ {
		for j := i; j > 0 && better(out[j], out[j-1], dir); j-- {
			out[j], out[j-1] = out[j-1], out[j]
		}
	}
	if limit > 0 && len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}

func better(a, b domain.ScoreEntry, dir domain.ScoreDirection) bool {
	if dir == domain.LowerIsBetter {
		return a.Value < b.Value
	}
	return a.Value > b.Value
}

type memSessions struct{ byToken map[string]domain.Session }

func (s *memSessions) Create(_ context.Context, sess domain.Session) error {
	s.byToken[sess.Token] = sess
	return nil
}

func (s *memSessions) Get(_ context.Context, token string) (domain.Session, error) {
	sess, ok := s.byToken[token]
	if !ok {
		return domain.Session{}, storage.ErrNotFound
	}
	return sess, nil
}

func (s *memSessions) Consume(_ context.Context, token string) (domain.Session, error) {
	sess, ok := s.byToken[token]
	if !ok || sess.ConsumedAt != nil {
		return domain.Session{}, storage.ErrConflict
	}
	now := time.Now()
	sess.ConsumedAt = &now
	s.byToken[token] = sess
	return sess, nil
}

type memAwards struct{ byID map[string]domain.Award }

func (a *memAwards) List(context.Context) ([]domain.Award, error) {
	out := make([]domain.Award, 0, len(a.byID))
	for _, v := range a.byID {
		out = append(out, v)
	}
	return out, nil
}

func (a *memAwards) Get(_ context.Context, id string) (domain.Award, error) {
	v, ok := a.byID[id]
	if !ok {
		return domain.Award{}, storage.ErrNotFound
	}
	return v, nil
}

func (a *memAwards) Create(_ context.Context, v domain.Award) (domain.Award, error) {
	a.byID[v.ID] = v
	return v, nil
}

func (a *memAwards) Update(_ context.Context, v domain.Award) (domain.Award, error) {
	a.byID[v.ID] = v
	return v, nil
}

func (a *memAwards) Delete(_ context.Context, id string) error {
	delete(a.byID, id)
	return nil
}

func (a *memAwards) DecrementStock(_ context.Context, id string) error {
	v, ok := a.byID[id]
	if !ok {
		return storage.ErrNotFound
	}
	if v.Stock == domain.Unlimited {
		return nil
	}
	if v.Stock <= 0 {
		return storage.ErrConflict
	}
	v.Stock--
	a.byID[id] = v
	return nil
}

// memClaims models the two guarantees the service leans on: a unique code, and
// a redemption that can only happen once. Insertion order is kept so List can
// return newest-first the way the SQL ORDER BY does.
type memClaims struct {
	byCode map[string]domain.Claim
	order  []string
	// failCreate makes every insert fail, to exercise the path where a win is
	// recorded but no claim could be issued.
	failCreate bool
}

func (c *memClaims) Create(_ context.Context, v domain.Claim) (domain.Claim, error) {
	if c.failCreate {
		return domain.Claim{}, errors.New("claims are down")
	}
	if _, taken := c.byCode[v.Code]; taken {
		return domain.Claim{}, storage.ErrConflict
	}
	c.byCode[v.Code] = v
	c.order = append(c.order, v.Code)
	return v, nil
}

func (c *memClaims) GetByCode(_ context.Context, code string) (domain.Claim, error) {
	v, ok := c.byCode[code]
	if !ok {
		return domain.Claim{}, storage.ErrNotFound
	}
	return v, nil
}

func (c *memClaims) GetByScore(_ context.Context, scoreID string) (domain.Claim, error) {
	for _, code := range c.order {
		if v := c.byCode[code]; v.ScoreID == scoreID {
			return v, nil
		}
	}
	return domain.Claim{}, storage.ErrNotFound
}

func (c *memClaims) List(context.Context) ([]domain.Claim, error) {
	out := make([]domain.Claim, 0, len(c.order))
	for i := len(c.order) - 1; i >= 0; i-- { // newest first
		out = append(out, c.byCode[c.order[i]])
	}
	return out, nil
}

// Redeem mirrors the SQL guard: it only writes when redeemed_at is still unset,
// so a second attempt conflicts rather than overwriting the first.
func (c *memClaims) Redeem(_ context.Context, code string, at time.Time) (domain.Claim, error) {
	v, ok := c.byCode[code]
	if !ok {
		return domain.Claim{}, storage.ErrNotFound
	}
	if v.RedeemedAt != nil {
		return domain.Claim{}, storage.ErrConflict
	}
	stamp := at
	v.RedeemedAt = &stamp
	c.byCode[code] = v
	return v, nil
}

// Unredeem mirrors the SQL guard in the other direction: it only clears a stamp
// that is actually set, so undoing twice conflicts rather than looking like it
// worked.
func (c *memClaims) Unredeem(_ context.Context, code string) (domain.Claim, error) {
	v, ok := c.byCode[code]
	if !ok {
		return domain.Claim{}, storage.ErrNotFound
	}
	if v.RedeemedAt == nil {
		return domain.Claim{}, storage.ErrConflict
	}
	v.RedeemedAt = nil
	c.byCode[code] = v
	return v, nil
}

// memSettings always misses, so the service falls back to its defaults.
type memSettings struct{}

func (memSettings) List(context.Context) ([]domain.Setting, error) { return nil, nil }
func (memSettings) Get(context.Context, string) (domain.Setting, error) {
	return domain.Setting{}, storage.ErrNotFound
}
func (memSettings) Upsert(_ context.Context, s domain.Setting) (domain.Setting, error) { return s, nil }
func (memSettings) Delete(context.Context, string) error                               { return nil }

// --- helpers ----------------------------------------------------------------

// playRound runs a full session→submit cycle and returns the result.
func playRound(t *testing.T, svc *Service, name string, value int) SubmitResult {
	t.Helper()
	ctx := context.Background()
	sess, _, err := svc.StartSession(ctx, game.SlugTapFast)
	if err != nil {
		t.Fatalf("StartSession: %v", err)
	}
	res, err := svc.SubmitScore(ctx, SubmitInput{
		GameSlug:   game.SlugTapFast,
		Token:      sess.Token,
		PlayerName: name,
		Value:      value,
	})
	if err != nil {
		t.Fatalf("SubmitScore: %v", err)
	}
	return res
}

// newTestService builds a service whose clock advances one round-length per
// call, so the server-derived elapsed time mirrors a real 5s round and the
// plausibility check behaves as it does in production.
func newTestService(store *memStore) *Service {
	tick := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	return New(store, game.DefaultRegistry(), func() time.Time {
		tick = tick.Add(5 * time.Second)
		return tick
	})
}

// stackDrops plays `blocks` perfect drops of a Stack round, returning the
// timings a real client would report. It searches each sweep for the moment the
// block sits over the tower, exactly as game.ScoreStack's own tests do — a
// Stack round cannot be written as literal numbers, because every drop's phase
// is inherited from the drop before it.
func stackDrops(blocks int) []int {
	drops := make([]int, 0, blocks)
	spawnedAt := 0
	centre := game.StackTrackWidth / 2
	for i := range blocks {
		period := game.StackPeriodMs(i)
		best, bestOff := spawnedAt+1, game.StackTrackWidth
		for phase := 1; phase <= period; phase++ {
			off := game.StackBlockCentre(phase, game.StackBaseWidth, period, i%2 == 0) - centre
			if off < 0 {
				off = -off
			}
			if off < bestOff {
				best, bestOff = spawnedAt+phase, off
			}
		}
		drops = append(drops, best)
		spawnedAt = best
	}
	return drops
}

// --- tests ------------------------------------------------------------------

// The headline claim of a server-scored game: the number the client asserts is
// not merely checked, it is never read. This test sends a wildly inflated value
// alongside honest events and expects the events to win — if scoreOf ever falls
// back to in.Value for a game with a Scorer, this is what catches it.
func TestSubmitScoreIgnoresTheClientsValueForAServerScoredGame(t *testing.T) {
	store := newMemStore()
	svc := newTestService(store)
	ctx := context.Background()

	sess, _, err := svc.StartSession(ctx, game.SlugStack)
	if err != nil {
		t.Fatalf("StartSession: %v", err)
	}
	drops := stackDrops(5)
	res, err := svc.SubmitScore(ctx, SubmitInput{
		GameSlug:   game.SlugStack,
		Token:      sess.Token,
		PlayerName: "Po",
		Value:      9999, // a lie, and one the server has no reason to consult
		Events:     drops,
	})
	if err != nil {
		t.Fatalf("SubmitScore: %v", err)
	}
	if res.Score.Value != len(drops) {
		t.Fatalf("recorded %d, want %d — the score must come from the events, not the client",
			res.Score.Value, len(drops))
	}
}

// The mirror of the above: with no events there is nothing to replay, so the
// round scores zero rather than inheriting whatever value was sent.
func TestSubmitScoreScoresAServerScoredGameZeroWithoutEvents(t *testing.T) {
	store := newMemStore()
	svc := newTestService(store)
	ctx := context.Background()

	sess, _, err := svc.StartSession(ctx, game.SlugStack)
	if err != nil {
		t.Fatalf("StartSession: %v", err)
	}
	res, err := svc.SubmitScore(ctx, SubmitInput{
		GameSlug:   game.SlugStack,
		Token:      sess.Token,
		PlayerName: "Po",
		Value:      40,
	})
	if err != nil {
		t.Fatalf("SubmitScore: %v", err)
	}
	if res.Score.Value != 0 {
		t.Fatalf("recorded %d, want 0 — no events means no blocks stacked", res.Score.Value)
	}
}

// Events that could not have come from a real round are rejected outright,
// rather than scored as far as they parse.
func TestSubmitScoreRejectsImpossibleEvents(t *testing.T) {
	store := newMemStore()
	svc := newTestService(store)
	ctx := context.Background()

	sess, _, err := svc.StartSession(ctx, game.SlugStack)
	if err != nil {
		t.Fatalf("StartSession: %v", err)
	}
	_, err = svc.SubmitScore(ctx, SubmitInput{
		GameSlug:   game.SlugStack,
		Token:      sess.Token,
		PlayerName: "Po",
		Events:     []int{900, 400}, // time does not run backwards
	})
	if !errors.Is(err, ErrScoreRejected) {
		t.Fatalf("err = %v, want ErrScoreRejected", err)
	}
}

// A server-scored game must still hand the client the physics it has to render
// the round with — without the challenge there is nothing to simulate.
func TestStartSessionCarriesTheChallengeForAServerScoredGame(t *testing.T) {
	store := newMemStore()
	svc := newTestService(store)
	ctx := context.Background()

	_, def, err := svc.StartSession(ctx, game.SlugStack)
	if err != nil {
		t.Fatalf("StartSession: %v", err)
	}
	if def.Challenge == nil {
		t.Fatal("stack session carries no challenge")
	}
	ch, ok := def.Challenge().(game.StackChallenge)
	if !ok {
		t.Fatalf("challenge is %T, want game.StackChallenge", def.Challenge())
	}
	if ch.TrackWidth != game.StackTrackWidth || ch.BaseWidth != game.StackBaseWidth {
		t.Fatalf("challenge geometry %+v does not match the catalog's constants", ch)
	}

	// And a client-scored game must not: an absent challenge is how the player
	// app knows which of the two protocols a game speaks.
	_, tapDef, err := svc.StartSession(ctx, game.SlugTapFast)
	if err != nil {
		t.Fatalf("StartSession: %v", err)
	}
	if tapDef.Challenge != nil {
		t.Fatal("tap-fast is client-scored and must carry no challenge")
	}
}

func TestSubmitScorePersistsWonAwardOnTheScore(t *testing.T) {
	store := newMemStore()
	store.awards.byID["a1"] = domain.Award{
		ID: "a1", Name: "Free Coffee", GameSlug: game.SlugTapFast,
		MinScore: 30, Stock: domain.Unlimited, Active: true,
	}
	svc := newTestService(store)

	res := playRound(t, svc, "Po", 40)

	if res.Award == nil {
		t.Fatal("expected an award for a qualifying score")
	}
	if res.Score.AwardID != "a1" {
		t.Fatalf("award id not persisted on the score: got %q, want %q", res.Score.AwardID, "a1")
	}
	// The stored row — not just the response — must carry the link.
	stored, err := store.scores.Get(context.Background(), res.Score.ID)
	if err != nil {
		t.Fatalf("stored score: %v", err)
	}
	if stored.AwardID != "a1" {
		t.Fatalf("stored award id = %q, want %q", stored.AwardID, "a1")
	}
}

func TestSubmitScoreWithoutPrizeStoresNoAwardID(t *testing.T) {
	store := newMemStore()
	store.awards.byID["a1"] = domain.Award{
		ID: "a1", Name: "Free Coffee", GameSlug: game.SlugTapFast,
		MinScore: 100, Stock: domain.Unlimited, Active: true,
	}
	svc := newTestService(store)

	res := playRound(t, svc, "Po", 10)

	if res.Award != nil {
		t.Fatalf("did not expect an award, got %q", res.Award.Name)
	}
	if res.Score.AwardID != "" {
		t.Fatalf("award id = %q, want empty", res.Score.AwardID)
	}
}

func TestScoreResultReturnsStoredAwardAndLiveRank(t *testing.T) {
	store := newMemStore()
	store.awards.byID["a1"] = domain.Award{
		ID: "a1", Name: "Free Coffee", GameSlug: game.SlugTapFast,
		MinScore: 30, Stock: domain.Unlimited, Active: true,
	}
	svc := newTestService(store)
	ctx := context.Background()

	first := playRound(t, svc, "Po", 40)
	if first.Rank != 1 {
		t.Fatalf("first round rank = %d, want 1", first.Rank)
	}

	// Someone better plays afterwards: the stored result's rank must reflect
	// the live leaderboard, while its prize must not change.
	playRound(t, svc, "Rival", 90)

	got, err := svc.ScoreResult(ctx, game.SlugTapFast, first.Score.ID)
	if err != nil {
		t.Fatalf("ScoreResult: %v", err)
	}
	if got.Rank != 2 {
		t.Fatalf("rank after being beaten = %d, want 2", got.Rank)
	}
	if got.Award == nil || got.Award.ID != "a1" {
		t.Fatalf("award = %v, want the originally granted a1", got.Award)
	}
	if got.Score.Value != 40 || got.Score.PlayerName != "Po" {
		t.Fatalf("score = %+v, want value 40 for Po", got.Score)
	}
}

func TestScoreResultKeepsPrizeAfterThresholdOrStockChanges(t *testing.T) {
	store := newMemStore()
	store.awards.byID["a1"] = domain.Award{
		ID: "a1", Name: "Free Coffee", GameSlug: game.SlugTapFast,
		MinScore: 30, Stock: 1, Active: true,
	}
	svc := newTestService(store)
	ctx := context.Background()

	res := playRound(t, svc, "Po", 40)

	// Admin raises the bar and the prize sells out — a re-derived decision would
	// now say "no prize", but the granted award must stand.
	a := store.awards.byID["a1"]
	a.MinScore = 500
	a.Active = false
	store.awards.byID["a1"] = a

	got, err := svc.ScoreResult(ctx, game.SlugTapFast, res.Score.ID)
	if err != nil {
		t.Fatalf("ScoreResult: %v", err)
	}
	if got.Award == nil || got.Award.ID != "a1" {
		t.Fatalf("award = %v, want the originally granted a1", got.Award)
	}
}

func TestScoreResultTreatsDeletedAwardAsNoPrize(t *testing.T) {
	store := newMemStore()
	store.awards.byID["a1"] = domain.Award{
		ID: "a1", Name: "Free Coffee", GameSlug: game.SlugTapFast,
		MinScore: 30, Stock: domain.Unlimited, Active: true,
	}
	svc := newTestService(store)
	ctx := context.Background()

	res := playRound(t, svc, "Po", 40)
	delete(store.awards.byID, "a1")

	got, err := svc.ScoreResult(ctx, game.SlugTapFast, res.Score.ID)
	if err != nil {
		t.Fatalf("ScoreResult should not fail on a deleted award: %v", err)
	}
	if got.Award != nil {
		t.Fatalf("award = %v, want nil after deletion", got.Award)
	}
	if got.Score.ID != res.Score.ID {
		t.Fatal("expected the score itself to still resolve")
	}
}

func TestScoreResultRejectsUnknownAndMismatchedLookups(t *testing.T) {
	store := newMemStore()
	svc := newTestService(store)
	ctx := context.Background()
	res := playRound(t, svc, "Po", 12)

	t.Run("unknown score id", func(t *testing.T) {
		_, err := svc.ScoreResult(ctx, game.SlugTapFast, "does-not-exist")
		if !errors.Is(err, storage.ErrNotFound) {
			t.Fatalf("err = %v, want ErrNotFound", err)
		}
	})

	t.Run("score id from another game", func(t *testing.T) {
		_, err := svc.ScoreResult(ctx, "other-game", res.Score.ID)
		if !errors.Is(err, ErrGameUnavailable) {
			t.Fatalf("err = %v, want ErrGameUnavailable", err)
		}
	})

	t.Run("slug that does not own the score", func(t *testing.T) {
		// Register the score under a different slug to isolate the ownership
		// check from the unknown-game check above.
		entry := res.Score
		entry.ID = "orphan"
		entry.GameSlug = "somewhere-else"
		if _, err := store.scores.Create(ctx, entry); err != nil {
			t.Fatalf("seed: %v", err)
		}
		_, err := svc.ScoreResult(ctx, game.SlugTapFast, "orphan")
		if !errors.Is(err, storage.ErrNotFound) {
			t.Fatalf("err = %v, want ErrNotFound", err)
		}
	})
}

// --- claims -----------------------------------------------------------------

// winningStore returns a store whose only award is winnable with a score of 40.
func winningStore() *memStore {
	store := newMemStore()
	store.awards.byID["a1"] = domain.Award{
		ID: "a1", Name: "Free Coffee", GameSlug: game.SlugTapFast,
		MinScore: 30, Stock: domain.Unlimited, Active: true,
	}
	return store
}

func TestSubmitScoreIssuesAClaimForAWin(t *testing.T) {
	store := winningStore()
	svc := newTestService(store)

	res := playRound(t, svc, "Po", 40)

	if res.Claim == nil {
		t.Fatal("a winning round issued no claim")
	}
	if res.Claim.Status != domain.ClaimIssued {
		t.Fatalf("status = %q, want %q", res.Claim.Status, domain.ClaimIssued)
	}
	if !id.LooksLikeClaimCode(res.Claim.Claim.Code) {
		t.Fatalf("code %q is not in the claim-code format", res.Claim.Claim.Code)
	}
	if res.Claim.Claim.ScoreID != res.Score.ID {
		t.Fatalf("claim points at score %q, want %q", res.Claim.Claim.ScoreID, res.Score.ID)
	}
	// The snapshot, not a reference — this is the whole point of the field.
	if res.Claim.Claim.AwardName != "Free Coffee" {
		t.Fatalf("award name = %q, want it copied onto the claim", res.Claim.Claim.AwardName)
	}
	// The default TTL applies (memSettings always misses), so it expires.
	if res.Claim.Claim.ExpiresAt.IsZero() {
		t.Fatal("claim has no expiry, but the default TTL is 168h")
	}
}

func TestSubmitScoreIssuesNoClaimWithoutAPrize(t *testing.T) {
	store := newMemStore()
	store.awards.byID["a1"] = domain.Award{
		ID: "a1", Name: "Free Coffee", GameSlug: game.SlugTapFast,
		MinScore: 100, Stock: domain.Unlimited, Active: true,
	}
	svc := newTestService(store)

	res := playRound(t, svc, "Po", 10)

	if res.Claim != nil {
		t.Fatalf("a losing round issued a claim: %+v", res.Claim)
	}
	if len(store.claims.byCode) != 0 {
		t.Fatalf("store holds %d claims, want none", len(store.claims.byCode))
	}
}

// A win whose claim could not be written must still be a win. The score row is
// already committed and the award's stock already spent by this point, so
// failing the submission would report a round that did not count when it did.
func TestSubmitScoreSurvivesAClaimThatCannotBeIssued(t *testing.T) {
	store := winningStore()
	store.claims.failCreate = true
	svc := newTestService(store)

	res := playRound(t, svc, "Po", 40) // playRound fails the test on any error

	if res.Award == nil {
		t.Fatal("the prize was lost along with the claim")
	}
	if res.Claim != nil {
		t.Fatalf("claim = %+v, want nil when it could not be written", res.Claim)
	}
}

func TestScoreResultReturnsTheSameClaimOnEveryVisit(t *testing.T) {
	store := winningStore()
	svc := newTestService(store)
	ctx := context.Background()

	res := playRound(t, svc, "Po", 40)
	issued := res.Claim.Claim.Code

	for visit := 1; visit <= 3; visit++ {
		again, err := svc.ScoreResult(ctx, game.SlugTapFast, res.Score.ID)
		if err != nil {
			t.Fatalf("visit %d: %v", visit, err)
		}
		if again.Claim == nil {
			t.Fatalf("visit %d: the claim vanished", visit)
		}
		if again.Claim.Claim.Code != issued {
			t.Fatalf("visit %d: code = %q, want the original %q", visit, again.Claim.Claim.Code, issued)
		}
	}
	// Re-reading a result must never mint a second claim for the same round.
	if len(store.claims.byCode) != 1 {
		t.Fatalf("store holds %d claims after 3 visits, want 1", len(store.claims.byCode))
	}
}

// The bug the snapshot exists to fix: deleting an award degrades the result to
// "no prize", which would otherwise rewrite what a permanent URL says was won.
func TestClaimKeepsThePrizeNameAfterTheAwardIsDeleted(t *testing.T) {
	store := winningStore()
	svc := newTestService(store)
	ctx := context.Background()

	res := playRound(t, svc, "Po", 40)
	if err := store.awards.Delete(ctx, "a1"); err != nil {
		t.Fatalf("delete award: %v", err)
	}

	after, err := svc.ScoreResult(ctx, game.SlugTapFast, res.Score.ID)
	if err != nil {
		t.Fatalf("ScoreResult: %v", err)
	}
	if after.Award != nil {
		t.Fatalf("award = %+v, want nil once deleted", after.Award)
	}
	if after.Claim == nil || after.Claim.Claim.AwardName != "Free Coffee" {
		t.Fatal("the claim lost the prize name when the award was deleted")
	}
}

func TestRedeemClaimWorksExactlyOnce(t *testing.T) {
	store := winningStore()
	svc := newTestService(store)
	ctx := context.Background()

	code := playRound(t, svc, "Po", 40).Claim.Claim.Code

	first, err := svc.RedeemClaim(ctx, code)
	if err != nil {
		t.Fatalf("first redeem: %v", err)
	}
	if first.Status != domain.ClaimRedeemed {
		t.Fatalf("status = %q, want %q", first.Status, domain.ClaimRedeemed)
	}
	if first.Claim.RedeemedAt == nil {
		t.Fatal("redeemed claim carries no timestamp")
	}

	_, err = svc.RedeemClaim(ctx, code)
	if !errors.Is(err, ErrClaimNotRedeemable) {
		t.Fatalf("second redeem err = %v, want ErrClaimNotRedeemable", err)
	}
}

// The code is read off a screen and typed at a counter, so it arrives in
// whatever shape a human produced.
func TestRedeemClaimAcceptsCodeAsAHumanTypesIt(t *testing.T) {
	store := winningStore()
	svc := newTestService(store)

	code := playRound(t, svc, "Po", 40).Claim.Claim.Code
	typed := strings.ToLower(code[:4]) + "-" + strings.ToLower(code[4:])

	if _, err := svc.RedeemClaim(context.Background(), " "+typed+" "); err != nil {
		t.Fatalf("redeeming %q (from %q): %v", typed, code, err)
	}
}

func TestRedeemClaimRejectsCodesThatDoNotResolve(t *testing.T) {
	svc := newTestService(winningStore())
	ctx := context.Background()

	cases := []struct{ name, code string }{
		// Well-formed but never issued.
		{"unissued", "ABCD2345"},
		// Malformed: rejected on shape, without touching the store. Both answer
		// ErrClaimNotFound so a guesser learns nothing about which shapes exist.
		{"too short", "ABCD234"},
		{"a confusable character", "ABCO2345"},
		{"an entity id", "V1StGXR8_Z5"},
		{"empty", ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if _, err := svc.RedeemClaim(ctx, c.code); !errors.Is(err, ErrClaimNotFound) {
				t.Fatalf("err = %v, want ErrClaimNotFound", err)
			}
		})
	}
}

func TestRedeemClaimRefusesAnExpiredClaimButStillReportsIt(t *testing.T) {
	store := winningStore()
	svc := newTestService(store)

	// Seeded directly: the service's clock starts in 2026, so a 2025 expiry is
	// unreachable by playing a round.
	store.claims.byCode["ABCD2345"] = domain.Claim{
		ID: "c1", Code: "ABCD2345", ScoreID: "s1", AwardID: "a1", AwardName: "Free Coffee",
		IssuedAt:  time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
		ExpiresAt: time.Date(2025, 1, 8, 0, 0, 0, 0, time.UTC),
	}
	store.claims.order = append(store.claims.order, "ABCD2345")

	view, err := svc.RedeemClaim(context.Background(), "ABCD2345")
	if !errors.Is(err, ErrClaimNotRedeemable) {
		t.Fatalf("err = %v, want ErrClaimNotRedeemable", err)
	}
	// An admin refused at the counter still has to see what it was.
	if view.Status != domain.ClaimExpired {
		t.Fatalf("status = %q, want %q", view.Status, domain.ClaimExpired)
	}
	if view.Claim.AwardName != "Free Coffee" {
		t.Fatalf("award name = %q, want it returned with the refusal", view.Claim.AwardName)
	}
	if store.claims.byCode["ABCD2345"].RedeemedAt != nil {
		t.Fatal("an expired claim was marked redeemed anyway")
	}
}

// A confirmation dialog is only worth having if it can name the prize, so the
// lookup has to answer with the award and WITHOUT spending the claim.
func TestGetClaimNamesThePrizeWithoutSpendingIt(t *testing.T) {
	store := winningStore()
	svc := newTestService(store)
	ctx := context.Background()

	code := playRound(t, svc, "Po", 40).Claim.Claim.Code

	peek, err := svc.GetClaim(ctx, code)
	if err != nil {
		t.Fatalf("GetClaim: %v", err)
	}
	if peek.Claim.AwardName != "Free Coffee" {
		t.Fatalf("award name = %q, want %q", peek.Claim.AwardName, "Free Coffee")
	}
	if peek.Status != domain.ClaimIssued {
		t.Fatalf("status = %q, want %q", peek.Status, domain.ClaimIssued)
	}

	// The whole point: looking is not taking.
	if _, err := svc.RedeemClaim(ctx, code); err != nil {
		t.Fatalf("redeem after a peek: %v", err)
	}
}

// The lookup must not be a cheaper oracle than the redeem endpoint it precedes:
// both answer ErrClaimNotFound for a code that does not exist AND for one that
// could not, so guessing tells you nothing about which shapes are real.
func TestGetClaimHidesWhetherACodeCouldExist(t *testing.T) {
	svc := newTestService(winningStore())
	ctx := context.Background()

	for _, code := range []string{"ABCD2345", "ABCD234", "ABCO2345", "V1StGXR8_Z5", ""} {
		if _, err := svc.GetClaim(ctx, code); !errors.Is(err, ErrClaimNotFound) {
			t.Fatalf("GetClaim(%q) err = %v, want ErrClaimNotFound", code, err)
		}
	}
}

// The repair a scanner makes necessary: a prize handed over by mistake goes back
// to outstanding, and can then be collected by the person who actually won it.
func TestUnredeemClaimReturnsAPrizeToOutstanding(t *testing.T) {
	store := winningStore()
	svc := newTestService(store)
	ctx := context.Background()

	code := playRound(t, svc, "Po", 40).Claim.Claim.Code
	if _, err := svc.RedeemClaim(ctx, code); err != nil {
		t.Fatalf("redeem: %v", err)
	}

	back, err := svc.UnredeemClaim(ctx, code)
	if err != nil {
		t.Fatalf("UnredeemClaim: %v", err)
	}
	if back.Status != domain.ClaimIssued {
		t.Fatalf("status = %q, want %q", back.Status, domain.ClaimIssued)
	}
	if back.Claim.RedeemedAt != nil {
		t.Fatalf("redeemedAt = %v, want it cleared", back.Claim.RedeemedAt)
	}

	// Un-redeeming is only a repair if the prize is collectable again afterwards.
	if _, err := svc.RedeemClaim(ctx, code); err != nil {
		t.Fatalf("redeem after unredeem: %v", err)
	}
}

func TestUnredeemClaimRefusesAPrizeNobodyCollected(t *testing.T) {
	store := winningStore()
	svc := newTestService(store)

	code := playRound(t, svc, "Po", 40).Claim.Claim.Code

	view, err := svc.UnredeemClaim(context.Background(), code)
	if !errors.Is(err, ErrClaimNotUnredeemable) {
		t.Fatalf("err = %v, want ErrClaimNotUnredeemable", err)
	}
	// Refused, but still described — same contract as a refused redemption.
	if view.Claim.AwardName != "Free Coffee" || view.Status != domain.ClaimIssued {
		t.Fatalf("view = %+v, want the issued claim returned with the refusal", view)
	}
}

// Undoing twice is the same shape of race as redeeming twice, and gets the same
// answer: the conditional write refuses the second one.
func TestUnredeemClaimWorksExactlyOnce(t *testing.T) {
	store := winningStore()
	svc := newTestService(store)
	ctx := context.Background()

	code := playRound(t, svc, "Po", 40).Claim.Claim.Code
	if _, err := svc.RedeemClaim(ctx, code); err != nil {
		t.Fatalf("redeem: %v", err)
	}
	if _, err := svc.UnredeemClaim(ctx, code); err != nil {
		t.Fatalf("first unredeem: %v", err)
	}
	if _, err := svc.UnredeemClaim(ctx, code); !errors.Is(err, ErrClaimNotUnredeemable) {
		t.Fatalf("second unredeem err = %v, want ErrClaimNotUnredeemable", err)
	}
}

// The surprising case, pinned so nobody "fixes" it: un-redeeming does not extend
// the window. A claim collected before its deadline and un-redeemed after it
// comes back EXPIRED, because the deadline is a fact about the round rather than
// about this correction.
func TestUnredeemClaimDoesNotExtendAnExpiredWindow(t *testing.T) {
	store := winningStore()
	svc := newTestService(store)
	ctx := context.Background()

	collected := time.Date(2025, 1, 5, 0, 0, 0, 0, time.UTC)
	store.claims.byCode["ABCD2345"] = domain.Claim{
		ID: "c1", Code: "ABCD2345", ScoreID: "s1", AwardID: "a1", AwardName: "Free Coffee",
		IssuedAt:   time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
		ExpiresAt:  time.Date(2025, 1, 8, 0, 0, 0, 0, time.UTC),
		RedeemedAt: &collected,
	}
	store.claims.order = append(store.claims.order, "ABCD2345")

	back, err := svc.UnredeemClaim(ctx, "ABCD2345")
	if err != nil {
		t.Fatalf("UnredeemClaim: %v", err)
	}
	if back.Status != domain.ClaimExpired {
		t.Fatalf("status = %q, want %q — the window must not reopen", back.Status, domain.ClaimExpired)
	}
	if _, err := svc.RedeemClaim(ctx, "ABCD2345"); !errors.Is(err, ErrClaimNotRedeemable) {
		t.Fatalf("redeem err = %v, want it still refused as expired", err)
	}
}

func TestListClaimsFiltersOnDerivedStatus(t *testing.T) {
	store := winningStore()
	svc := newTestService(store)
	ctx := context.Background()

	live := playRound(t, svc, "Live", 40).Claim.Claim.Code
	done := playRound(t, svc, "Done", 40).Claim.Claim.Code
	if _, err := svc.RedeemClaim(ctx, done); err != nil {
		t.Fatalf("redeem: %v", err)
	}
	// An expired one cannot be produced by playing, so it is seeded.
	store.claims.byCode["ABCD2345"] = domain.Claim{
		ID: "c9", Code: "ABCD2345", ScoreID: "s9", AwardName: "Old Mug",
		IssuedAt:  time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
		ExpiresAt: time.Date(2025, 1, 8, 0, 0, 0, 0, time.UTC),
	}
	store.claims.order = append(store.claims.order, "ABCD2345")

	cases := []struct {
		status domain.ClaimStatus
		want   []string
	}{
		{domain.ClaimIssued, []string{live}},
		{domain.ClaimRedeemed, []string{done}},
		{domain.ClaimExpired, []string{"ABCD2345"}},
		{"", []string{"ABCD2345", done, live}}, // newest first
	}
	for _, c := range cases {
		t.Run(string(c.status), func(t *testing.T) {
			got, err := svc.ListClaims(ctx, c.status)
			if err != nil {
				t.Fatalf("ListClaims: %v", err)
			}
			if len(got) != len(c.want) {
				t.Fatalf("got %d claims, want %d", len(got), len(c.want))
			}
			for i, code := range c.want {
				if got[i].Claim.Code != code {
					t.Fatalf("[%d] = %q, want %q", i, got[i].Claim.Code, code)
				}
				if got[i].Status == "" {
					t.Fatalf("[%d] carries no derived status", i)
				}
			}
		})
	}
}
