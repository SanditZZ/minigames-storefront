package app

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
	"github.com/sanditzz/minigames-storefront/backend/internal/game"
	"github.com/sanditzz/minigames-storefront/backend/internal/storage"
)

// --- test double ------------------------------------------------------------

// memStore is an in-memory storage.Store used to exercise the service without a
// database. Only the behaviours the service relies on are modelled.
type memStore struct {
	scores   *memScores
	sessions *memSessions
	awards   *memAwards
	settings *memSettings
}

func newMemStore() *memStore {
	return &memStore{
		scores:   &memScores{byID: map[string]domain.ScoreEntry{}},
		sessions: &memSessions{byToken: map[string]domain.Session{}},
		awards:   &memAwards{byID: map[string]domain.Award{}},
		settings: &memSettings{},
	}
}

func (m *memStore) Games() storage.GameRepository       { return nil }
func (m *memStore) Sessions() storage.SessionRepository { return m.sessions }
func (m *memStore) Scores() storage.ScoreRepository     { return m.scores }
func (m *memStore) Awards() storage.AwardRepository     { return m.awards }
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

// --- tests ------------------------------------------------------------------

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
