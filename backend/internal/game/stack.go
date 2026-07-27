package game

import (
	"fmt"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
)

// SlugStack is the stacking game: a block slides across the track and the
// player drops it onto the tower. Whatever hangs over the edge is trimmed off,
// so the tower narrows with every imperfect drop and the game gets harder from
// its own history. Miss the tower entirely and the round is over.
//
// It is the first game whose score the server COMPUTES rather than bounds-
// checks. The client reports when the player dropped each block; the server
// replays the round from those timings and counts what actually stacked. See
// ScoreStack.
const SlugStack domain.GameSlug = "stack"

// The tower's geometry, in VIRTUAL units — the same device-independent scale
// Precision Stop established with PrecisionTrackHalf, and for the same reason:
// a phone and a kiosk must produce identical scores, and the server must be
// able to replay a round without knowing anything about the display it came
// from.
//
// Every position in this game is an integer. That is not tidiness, it is the
// one thing standing between the two simulations — this one, and the renderer
// in packages/player-core/src/games/stack.ts — and a divergence the player
// experiences as the server calling a landed block a miss. Integer arithmetic
// is identical in Go and JavaScript; floating point is not. The track is wide
// (1000 rather than Precision Stop's 200) so that whole units are still fine
// enough to animate smoothly once the renderer scales them to pixels.
const (
	// StackTrackWidth is the full playfield the block slides across.
	StackTrackWidth = 1000
	// StackBaseWidth is the starting tower — and therefore the first block's
	// width, since a block is always as wide as the tower top it is aimed at.
	StackBaseWidth = 300
)

// The difficulty ramp. One full there-and-back sweep starts at
// StackBasePeriodMs and loses StackPeriodStepMs for every block placed, down to
// a floor of StackMinPeriodMs.
//
// The floor exists because the sweep is sampled at the player's reaction, not
// at a frame rate: below roughly half a second end-to-end, the difference
// between a perfect drop and a miss is shorter than a human can aim for, and
// the game stops being a test of timing and becomes one of luck.
const (
	StackBasePeriodMs = 1800
	StackMinPeriodMs  = 700
	StackPeriodStepMs = 90
)

// StackDurationMs is the round's ceiling. The round usually ends before it —
// one miss is fatal — but an unbounded run would leave a queue behind the
// player, which is the constraint a storefront game is really written against.
const StackDurationMs = 15000

// StackTargetBlocks is the house benchmark: stack this many and the reveal
// meter reads full. It is the threshold of the game's top starter award (see
// app.starterAwards), so "filled the tower" and "won the best prize" mean the
// same thing to a player rather than two unrelated scales.
const StackTargetBlocks = 12

// StackMaxDrops bounds the reported events so a submission cannot be an
// arbitrarily large array. A block must cross the track before it can land on
// the tower, so even perfect play cannot produce drops faster than roughly the
// minimum quarter-sweep; this ceiling is far above that and exists to bound the
// payload, not to judge the play.
const StackMaxDrops = StackDurationMs / (StackMinPeriodMs / 4)

// StackChallenge is the physics the client must render the round with.
//
// It carries no randomness — unlike a spawn schedule or a shuffled deck, this
// game needs none. The block's path is a pure function of time, and the round
// randomises ITSELF: block n is aimed at a tower whose position and width are
// the result of the player's own earlier drops, so there is no fixed rhythm to
// memorise. What the challenge is for is making the TUNING single-sourced. The
// simulation is necessarily written twice (once to render, once to score), and
// duplicating the constants as well is how the two would drift apart.
//
// Because it is constant, ScoreStack can and does ignore the stored challenge
// and score from the package constants directly. Precision Stop cannot — its
// phase is drawn per round — and that difference is why the challenge is stored
// on the session rather than regenerated at submit time.
type StackChallenge struct {
	TrackWidth   int `json:"trackWidth"`
	BaseWidth    int `json:"baseWidth"`
	BasePeriodMs int `json:"basePeriodMs"`
	MinPeriodMs  int `json:"minPeriodMs"`
	PeriodStepMs int `json:"periodStepMs"`
	MaxDrops     int `json:"maxDrops"`
}

// Stack is the catalog definition. It has a Scorer rather than a Validator:
// there is no client-reported number to validate, because the client does not
// report one.
var Stack = Definition{
	Game: domain.Game{
		Slug:        SlugStack,
		Name:        "Stack",
		Description: "Drop each block dead on the tower. Miss the edge and it is trimmed away — miss it completely and you are out!",
		ScoreUnit:   "blocks",
		Direction:   domain.HigherIsBetter,
		DurationMs:  StackDurationMs,
		TargetScore: StackTargetBlocks,
		Enabled:     true,
	},
	Challenge: stackChallenge,
	Scorer:    ScoreStack,
}

// stackChallenge ignores its Draw: see StackChallenge on why this game needs no
// randomness beyond the player's own timing.
func stackChallenge(Draw) any {
	return StackChallenge{
		TrackWidth:   StackTrackWidth,
		BaseWidth:    StackBaseWidth,
		BasePeriodMs: StackBasePeriodMs,
		MinPeriodMs:  StackMinPeriodMs,
		PeriodStepMs: StackPeriodStepMs,
		MaxDrops:     StackMaxDrops,
	}
}

// StackPeriodMs is the sweep period for the block being dropped at index n
// (0-based), applying the ramp down to its floor. Pure.
func StackPeriodMs(placed int) int {
	if placed < 0 {
		placed = 0
	}
	period := StackBasePeriodMs - placed*StackPeriodStepMs
	if period < StackMinPeriodMs {
		return StackMinPeriodMs
	}
	return period
}

// StackBlockCentre is where the sliding block's centre is, phaseMs into its own
// sweep, for a block of the given width.
//
// A triangle wave: the block runs to one end, turns, and comes back at the same
// speed. An eased turn would make the ends easier to hit than the middle, and
// this game is only interesting while the middle is the hard part — the same
// argument Precision Stop's sweepPosition makes.
//
// `fromLeft` alternates per block, so a new block enters from the side opposite
// the last one. That alternation is what makes an instant re-drop useless: a
// block begins at the edge, maximally far from a tower that is usually near the
// centre, so tapping the moment it appears misses rather than banking a free
// perfect drop. The physics enforce a minimum interval that no explicit rule
// has to.
//
// Integer arithmetic throughout, deliberately truncating: the mirror of this
// function in player-core must agree exactly, and floor division is the one
// rounding rule Go and JavaScript spell the same way.
func StackBlockCentre(phaseMs, width, periodMs int, fromLeft bool) int {
	travel := StackTrackWidth - width
	if travel <= 0 {
		return StackTrackWidth / 2
	}
	if periodMs <= 0 {
		periodMs = StackMinPeriodMs
	}
	if phaseMs < 0 {
		phaseMs = 0
	}

	half := periodMs / 2
	if half <= 0 {
		return width/2 + travel/2
	}

	p := phaseMs % periodMs
	var off int
	if p < half {
		off = p * travel / half
	} else {
		off = travel - (p-half)*travel/half
	}
	if off < 0 {
		off = 0
	}
	if off > travel {
		off = travel
	}
	if !fromLeft {
		off = travel - off
	}
	return width/2 + off
}

// ScoreStack replays a round from the player's drop timings and returns how
// many blocks actually stacked.
//
// This is the whole point of the game: the client sends WHEN the player
// dropped, never WHAT they scored, so the number recorded is a return value of
// this function rather than a field somebody filled in. A fabricated score is
// no longer a matter of typing a bigger integer — it means supplying timings
// that genuinely stack under these physics, which is doing the work.
//
// What it does NOT stop, and the honesty here matters as much as it does in
// validatePrecisionStop: a script that simulates the same physics can emit
// perfect timings. Nothing available to a client-rendered game closes that
// without device attestation. The bar moves from "POST a number" to "write a
// player", which is the achievable ceiling and worth stating rather than
// dressing up.
//
// A malformed event list is an error, not a zero: drops must be inside the
// round, strictly increasing, and bounded in number. A MISS, by contrast, is
// not an error at all — it is the ordinary way a round ends, and it scores the
// blocks placed before it. Pure: no clock, no storage.
//
// The stored challenge is ignored: this game's is a block of constants, so the
// numbers in it are already the ones below. See StackChallenge.
func ScoreStack(drops []int, durationMs int, _ []byte) (int, error) {
	if durationMs <= 0 {
		return 0, fmt.Errorf("round had no elapsed time")
	}
	if len(drops) > StackMaxDrops {
		return 0, fmt.Errorf("round reported %d drops, more than the %d a round can hold", len(drops), StackMaxDrops)
	}

	// Whether the events describe a real round is a property of ALL of them, so
	// it is settled before any are replayed. Checking lazily inside the replay
	// would make rejection depend on where the tower happened to fall: a
	// submission whose first drop missed would return a score and never look at
	// the nonsense that followed it, so the same dishonest payload would be
	// rejected or not according to the player's own aim.
	for i, at := range drops {
		if at < 0 || at > durationMs {
			return 0, fmt.Errorf("drop at %dms falls outside the %dms round", at, durationMs)
		}
		if i > 0 && at <= drops[i-1] {
			return 0, fmt.Errorf("drop at %dms does not follow the previous one at %dms", at, drops[i-1])
		}
	}

	// The base the first block is aimed at, centred on the track.
	left := (StackTrackWidth - StackBaseWidth) / 2
	right := left + StackBaseWidth
	// When the block currently in play began its sweep: the moment the previous
	// one was dropped. This is what makes the round self-randomising — every
	// block's phase is inherited from the player's own timing.
	spawnedAt := 0

	for i, at := range drops {
		width := right - left
		centre := StackBlockCentre(at-spawnedAt, width, StackPeriodMs(i), i%2 == 0)
		blockLeft := centre - width/2
		blockRight := blockLeft + width

		overlapLeft := max(left, blockLeft)
		overlapRight := min(right, blockRight)
		if overlapRight <= overlapLeft {
			// Missed the tower entirely. The round ended here, and every drop
			// the client reported after it is discarded rather than rejected —
			// a client that keeps sending is wrong, not dishonest, and the
			// score is settled either way.
			return i, nil
		}

		left, right = overlapLeft, overlapRight
		spawnedAt = at
	}
	return len(drops), nil
}
