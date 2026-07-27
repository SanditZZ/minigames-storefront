package game

import (
	"encoding/json"
	"fmt"

	"github.com/sanditzz/minigames-storefront/backend/internal/domain"
)

// SlugPrecisionStop is the timing game: a marker sweeps a track and the player
// stops it as close to the centre as they can. The score is how far off centre
// they landed, so LOWER is better — and, unlike a reaction time, a perfect
// round scores exactly 0. That is the whole reason this game exists: 0 is the
// GOAL here rather than an impossibility, which is the one case the reveal
// meter used to assume away (see domain.Game.TargetScore).
//
// The server SCORES this game rather than bounds-checking it. The client reports
// the single moment the player stopped the marker; the server replays the sweep
// from the phase it issued and works out the distance itself. See
// ScorePrecisionStop for what that does and does not buy.
const SlugPrecisionStop domain.GameSlug = "precision-stop"

// PrecisionTrackHalf is the virtual half-width of the track, and therefore the
// worst possible score: stopping at either end is PrecisionTrackHalf off centre.
//
// It is a VIRTUAL unit, not pixels. The client renders its track at whatever
// width the screen allows and positions are always expressed against this fixed
// scale, so a phone and a kiosk screen produce comparable scores.
//
// Deliberately NOT part of the challenge, unlike the sweep period below. This is
// the SCORING SCALE — every award's MinScore for this game is written in these
// units — so a round that could arrive with its own scale would be a round whose
// prize thresholds meant something different. Tuning travels; the unit does not.
const PrecisionTrackHalf = 100

// PrecisionTrackWidth is the full sweep, end to end. Centre is at
// PrecisionTrackHalf.
const PrecisionTrackWidth = PrecisionTrackHalf * 2

// PrecisionTargetOff is the house benchmark: land within this of centre and the
// reveal meter reads full. It is the threshold of the game's top starter prize
// (see app.starterAwards), so "dead centre" and "won the best prize" mean the
// same thing to a player rather than two unrelated scales.
const PrecisionTargetOff = 5

// PrecisionSweepPeriodMs is one full there-and-back sweep. It is the game's
// difficulty knob and travels in the challenge, so the client renders the sweep
// the server will score it against rather than its own copy of this number.
const PrecisionSweepPeriodMs = 1400

// PrecisionDurationMs is the round's ceiling — and the deadline a player who
// never stops the marker runs into, scoring the worst legal distance.
const PrecisionDurationMs = 6000

// PrecisionChallenge is the round the client must render.
//
// PhaseMs is the point in the sweep the marker starts from, drawn per round. It
// is the reason this challenge has to be STORED rather than regenerated at
// submit time: it is the one number without which the server cannot say where
// the marker was when the player stopped it, and a fresh draw would score the
// round against a sweep the player never saw. Contrast StackChallenge, which is
// constant and could be rebuilt from thin air.
//
// Drawing it server-side is also what closes the hole this game had: while the
// phase was `Math.random()` in the component, the client held a number the
// server did not, so no stop time could be checked against anything.
type PrecisionChallenge struct {
	PhaseMs  int `json:"phaseMs"`
	PeriodMs int `json:"periodMs"`
}

// PrecisionStop is the catalog definition. It has a Scorer rather than a
// Validator: there is no client-reported distance to validate, because the
// client does not report one.
var PrecisionStop = Definition{
	Game: domain.Game{
		Slug:        SlugPrecisionStop,
		Name:        "Precision Stop",
		Description: "Stop the marker dead centre. The closer you land, the lower your score — and lowest wins!",
		ScoreUnit:   "off",
		Direction:   domain.LowerIsBetter,
		DurationMs:  PrecisionDurationMs,
		TargetScore: PrecisionTargetOff,
		Enabled:     true,
	},
	Challenge: precisionChallenge,
	Scorer:    ScorePrecisionStop,
}

// precisionChallenge draws the round's opening phase.
//
// Anywhere in the sweep is fair: the marker's speed is constant, so no phase is
// easier than another — what the draw defeats is a player who has learned one
// fixed opening and counts their way to the centre.
func precisionChallenge(draw Draw) any {
	return PrecisionChallenge{
		PhaseMs:  draw(PrecisionSweepPeriodMs),
		PeriodMs: PrecisionSweepPeriodMs,
	}
}

// PrecisionSweepPosition is where the marker is `elapsedMs` into a round that
// began at `phaseMs` of its sweep, as a position in 0…PrecisionTrackWidth.
//
// A triangle wave: the marker runs to one end, turns, and comes back at the same
// speed. An eased turn would make the ends easier to hit than the middle, and
// this game is only interesting while the middle is the hard part.
//
// Integer arithmetic throughout, deliberately truncating — the same rule and the
// same reason as StackBlockCentre. This function has a mirror in
// packages/player-core/src/games/precision.ts and the two must agree exactly:
// the client draws the marker from it and the server scores from it, so a
// divergence is not a wrong number in a log, it is a player stopping the marker
// dead centre and being told they were eleven off. Floor division on
// non-negative operands is the one rounding rule Go and JavaScript spell the
// same way, and every quotient below is non-negative.
func PrecisionSweepPosition(elapsedMs, phaseMs, periodMs int) int {
	if periodMs <= 0 {
		periodMs = PrecisionSweepPeriodMs
	}
	if elapsedMs < 0 {
		elapsedMs = 0
	}
	if phaseMs < 0 {
		phaseMs = 0
	}

	half := periodMs / 2
	if half <= 0 {
		// A period too short to have two halves has no sweep to speak of; the
		// centre is the only answer that is not a lie about where the marker was.
		return PrecisionTrackHalf
	}

	t := (elapsedMs + phaseMs) % periodMs
	var pos int
	if t < half {
		pos = t * PrecisionTrackWidth / half
	} else {
		pos = PrecisionTrackWidth - (t-half)*PrecisionTrackWidth/half
	}
	if pos < 0 {
		pos = 0
	}
	if pos > PrecisionTrackWidth {
		pos = PrecisionTrackWidth
	}
	return pos
}

// PrecisionMissDistance is what stopping at `position` is worth: the distance
// from centre. Zero is legal and is the point of the game.
func PrecisionMissDistance(position int) int {
	off := position - PrecisionTrackHalf
	if off < 0 {
		off = -off
	}
	if off > PrecisionTrackHalf {
		off = PrecisionTrackHalf
	}
	return off
}

// ScorePrecisionStop replays the sweep and returns how far off centre the player
// stopped the marker.
//
// This is the game that most needed it. Tap Fast has a physiological ceiling to
// appeal to and Reaction Timer a physiological floor, so a fabricated score for
// either has to at least be humanly possible; this game's old validator could
// only check that a distance was on the track, which made a fabricated 0 —
// a perfect round — indistinguishable from a real one. Now the client reports
// WHEN it stopped and the distance is this function's return value.
//
// What it does NOT stop, stated as plainly as ScoreStack states it: a script
// that simulates this sweep can compute the moment the marker crosses centre and
// report it. The bar moves from "POST a zero" to "write a player", which is the
// ceiling for anything client-rendered without device attestation.
//
// The event list is the round's shape, and each malformation means something
// different:
//   - EMPTY is a timeout, not an error. A player who never stops the marker is
//     an ordinary outcome and scores the worst legal distance, exactly as the
//     client's own clock-expiry path always has.
//   - MORE THAN ONE stop cannot have happened: the round ends on the first one.
//   - A stop outside the round did not happen either.
//
// A missing or unreadable challenge is an error rather than a fallback to the
// built-in phase of 0. Scoring against a phase the player did not play would
// silently produce a distance from a sweep that never ran, which is worse than
// refusing: the player would be told a number with no relationship to what they
// watched. Pure: no clock, no storage.
func ScorePrecisionStop(events []int, durationMs int, challenge []byte) (int, error) {
	if durationMs <= 0 {
		return 0, fmt.Errorf("round had no elapsed time")
	}
	if len(events) == 0 {
		return PrecisionTrackHalf, nil
	}
	if len(events) > 1 {
		return 0, fmt.Errorf("round reported %d stops, but the marker can only be stopped once", len(events))
	}

	ch, err := precisionChallengeOf(challenge)
	if err != nil {
		return 0, err
	}

	stop := events[0]
	if stop < 0 || stop > durationMs {
		return 0, fmt.Errorf("stop at %dms falls outside the %dms round", stop, durationMs)
	}
	return PrecisionMissDistance(PrecisionSweepPosition(stop, ch.PhaseMs, ch.PeriodMs)), nil
}

// precisionChallengeOf reads the stored challenge, rejecting anything it cannot
// score against.
//
// Strict on purpose, and the opposite of the client's per-field fallback: the
// client may substitute a built-in constant to stay renderable, but the server
// is deciding a score and has nothing to fall back TO. A phase outside its own
// sweep is rejected rather than wrapped, because a challenge this build did not
// write is a challenge this build should not pretend to understand.
func precisionChallengeOf(raw []byte) (PrecisionChallenge, error) {
	if len(raw) == 0 {
		return PrecisionChallenge{}, fmt.Errorf("round was issued no challenge to score against")
	}
	var ch PrecisionChallenge
	if err := json.Unmarshal(raw, &ch); err != nil {
		return PrecisionChallenge{}, fmt.Errorf("round's challenge could not be read")
	}
	if ch.PeriodMs <= 0 {
		return PrecisionChallenge{}, fmt.Errorf("round's challenge has no sweep period")
	}
	if ch.PhaseMs < 0 || ch.PhaseMs >= ch.PeriodMs {
		return PrecisionChallenge{}, fmt.Errorf("round's challenge starts at %dms, outside its own %dms sweep", ch.PhaseMs, ch.PeriodMs)
	}
	return ch, nil
}
