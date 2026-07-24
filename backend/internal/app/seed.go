package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
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

	// Starter awards only when the store has none, so re-seeding won't duplicate.
	existing, err := s.store.Awards().List(ctx)
	if err != nil {
		return err
	}
	if len(existing) == 0 {
		for _, a := range starterAwards(now) {
			if _, err := s.store.Awards().Create(ctx, a); err != nil {
				return err
			}
		}
	}
	return nil
}

func defaultSettings() []domain.Setting {
	return []domain.Setting{
		{Key: domain.SettingSessionTTLSeconds, Value: "120", Type: domain.SettingInt, Description: "Seconds a play session stays valid before a score must be submitted."},
		{Key: domain.SettingMaxTapsPerSecond, Value: "20", Type: domain.SettingInt, Description: "Anti-cheat ceiling: taps/second above which a score is rejected."},
		{Key: domain.SettingHighScoreLimit, Value: "10", Type: domain.SettingInt, Description: "How many entries a leaderboard returns by default."},
		{Key: domain.SettingAllowReplays, Value: "true", Type: domain.SettingBool, Description: "Whether a player may start another session immediately after playing."},
	}
}

func starterAwards(now time.Time) []domain.Award {
	// Three tiers for tap-fast so the reward flow is demonstrable out of the box.
	mk := func(name, desc string, min, stock, order int) domain.Award {
		return domain.Award{
			ID:          uuid.NewString(),
			Name:        name,
			Description: desc,
			GameSlug:    domain.GameSlug("tap-fast"),
			MinScore:    min,
			Stock:       stock,
			Active:      true,
			SortOrder:   order,
			CreatedAt:   now,
			UpdatedAt:   now,
		}
	}
	return []domain.Award{
		mk("10% Off Coupon", "A small thank-you for playing.", 20, domain.Unlimited, 1),
		mk("Free Coffee", "Reach 40 taps to earn a free coffee.", 40, 100, 2),
		mk("Store Tote Bag", "Reach 60 taps for a limited-edition tote.", 60, 25, 3),
	}
}
