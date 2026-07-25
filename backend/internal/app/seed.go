package app

import (
	"context"
	"time"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
	"github.com/sanditzz/minigames-storefront/backend/internal/game"
	"github.com/sanditzz/minigames-storefront/backend/internal/id"
)

// Seed makes the store usable on first boot: it registers the catalog games,
// installs default settings, and adds starter awards if none exist. It is
// idempotent — safe to run on every startup — so it never clobbers data an
// admin has since edited.
func (s *Service) Seed(ctx context.Context) error {
	now := s.now()

	// Games mirror the in-code registry so the DB catalog stays in sync.
	for _, g := range s.registry.Games() {
		if err := s.store.Games().Upsert(ctx, g); err != nil {
			return err
		}
	}

	// Default settings are only inserted when absent (never overwritten).
	for _, d := range defaultSettings() {
		if _, err := s.store.Settings().Get(ctx, d.Key); err == nil {
			continue
		}
		d.UpdatedAt = now
		if _, err := s.store.Settings().Upsert(ctx, d); err != nil {
			return err
		}
	}

	// Starter awards are seeded PER GAME, and only for a game that has none.
	//
	// Per-game rather than "only when the store is empty" so that adding a game
	// to the catalog gives it a demonstrable prize ladder on an existing
	// database too — otherwise a new game ships with an empty prize showcase
	// forever. Still idempotent: a game whose awards an admin has edited (or
	// added to) is never touched again.
	existing, err := s.store.Awards().List(ctx)
	if err != nil {
		return err
	}
	seeded := make(map[domain.GameSlug]bool, len(existing))
	for _, a := range existing {
		seeded[a.GameSlug] = true
	}
	for _, a := range starterAwards(now) {
		if seeded[a.GameSlug] {
			continue
		}
		if _, err := s.store.Awards().Create(ctx, a); err != nil {
			return err
		}
	}
	return nil
}

func defaultSettings() []domain.Setting {
	return []domain.Setting{
		{Key: domain.SettingSessionTTLSeconds, Value: "120", Type: domain.SettingInt, Description: "Seconds a play session stays valid before a score must be submitted."},
		{Key: domain.SettingMaxTapsPerSecond, Value: "20", Type: domain.SettingInt, Description: "Anti-cheat ceiling: taps/second above which a score is rejected."},
		{Key: domain.SettingMinReactionMs, Value: "80", Type: domain.SettingInt, Description: "Anti-cheat floor: reaction times faster than this (ms) are rejected as impossible."},
		{Key: domain.SettingHighScoreLimit, Value: "10", Type: domain.SettingInt, Description: "How many entries a leaderboard returns by default."},
		{Key: domain.SettingAllowReplays, Value: "true", Type: domain.SettingBool, Description: "Whether a player may start another session immediately after playing."},
		{Key: domain.SettingClaimTTLHours, Value: "168", Type: domain.SettingInt, Description: "Hours a won prize stays claimable. 0 means claims never expire."},
	}
}

func starterAwards(now time.Time) []domain.Award {
	// A three-tier ladder per game so the reward flow is demonstrable out of the
	// box. Note the thresholds run in opposite directions: tap-fast is
	// higher-is-better (more taps), reaction-timer and precision-stop are
	// lower-is-better (a faster time, a smaller miss), so their hardest prize
	// carries the SMALLEST MinScore.
	//
	// The hardest prize's threshold is also each game's TargetScore, so a player
	// who fills the reveal tower is exactly a player who won the top prize.
	mk := func(slug domain.GameSlug, name, desc string, min, stock, order int) domain.Award {
		return domain.Award{
			ID:          id.New(),
			Name:        name,
			Description: desc,
			GameSlug:    slug,
			MinScore:    min,
			Stock:       stock,
			Active:      true,
			SortOrder:   order,
			CreatedAt:   now,
			UpdatedAt:   now,
		}
	}
	return []domain.Award{
		mk(game.SlugTapFast, "10% Off Coupon", "A small thank-you for playing.", 20, domain.Unlimited, 1),
		mk(game.SlugTapFast, "Free Coffee", "Reach 40 taps to earn a free coffee.", 40, 100, 2),
		mk(game.SlugTapFast, "Store Tote Bag", "Reach 60 taps for a limited-edition tote.", 60, 25, 3),

		mk(game.SlugReactionTimer, "10% Off Coupon", "React in under 400ms for a thank-you discount.", 400, domain.Unlimited, 1),
		mk(game.SlugReactionTimer, "Free Coffee", "React in under 300ms to earn a free coffee.", 300, 100, 2),
		mk(game.SlugReactionTimer, "Store Tote Bag", "React in under 220ms for a limited-edition tote.", 220, 25, 3),

		mk(game.SlugPrecisionStop, "10% Off Coupon", "Stop within 25 of centre for a thank-you discount.", 25, domain.Unlimited, 1),
		mk(game.SlugPrecisionStop, "Free Coffee", "Stop within 12 of centre to earn a free coffee.", 12, 100, 2),
		mk(game.SlugPrecisionStop, "Store Tote Bag", "Stop within 5 of centre for a limited-edition tote.", 5, 25, 3),
	}
}
