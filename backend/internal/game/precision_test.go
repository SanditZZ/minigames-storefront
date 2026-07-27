package game

import (
	"encoding/json"
	"testing"
)

// challengeFor is the fixture helper: the stored challenge for a round with a
// known phase, as the service would have written it.
func challengeFor(t *testing.T, phaseMs, periodMs int) []byte {
	t.Helper()
	raw, err := json.Marshal(PrecisionChallenge{PhaseMs: phaseMs, PeriodMs: periodMs})
	if err != nil {
		t.Fatalf("marshal challenge: %v", err)
	}
	return raw
}

// The sweep is a triangle wave, so the three positions worth pinning by hand are
// its ends and its middle. Everything else is covered by the golden fixture.
func TestPrecisionSweepPosition_TracesTheTriangle(t *testing.T) {
	const period = PrecisionSweepPeriodMs
	cases := []struct {
		name           string
		elapsed, phase int
		want           int
	}{
		{"starts at the left edge on a zero phase", 0, 0, 0},
		{"reaches the far end at half a period", period / 2, 0, PrecisionTrackWidth},
		{"returns to the left edge after a full period", period, 0, 0},
		{"crosses centre a quarter in", period / 4, 0, PrecisionTrackHalf},
		{"crosses centre again three quarters in", 3 * period / 4, 0, PrecisionTrackHalf},
		// A phase is just a head start: elapsed 0 with phase p must equal
		// elapsed p with phase 0, or the client and server disagree about what
		// the number means.
		{"a phase offsets the sweep", 0, period / 4, PrecisionTrackHalf},
		{"phase and elapsed are interchangeable", period / 8, period / 8, PrecisionTrackHalf},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := PrecisionSweepPosition(c.elapsed, c.phase, period); got != c.want {
				t.Fatalf("position = %d, want %d", got, c.want)
			}
		})
	}
}

// The marker must never leave the track, whatever it is asked. A position off
// the end would score worse than the worst legal distance.
func TestPrecisionSweepPosition_StaysOnTheTrack(t *testing.T) {
	for elapsed := 0; elapsed <= 3*PrecisionSweepPeriodMs; elapsed += 7 {
		for _, phase := range []int{0, 1, 349, 700, 1399} {
			pos := PrecisionSweepPosition(elapsed, phase, PrecisionSweepPeriodMs)
			if pos < 0 || pos > PrecisionTrackWidth {
				t.Fatalf("position %d off a track 0…%d (elapsed %d, phase %d)",
					pos, PrecisionTrackWidth, elapsed, phase)
			}
			if off := PrecisionMissDistance(pos); off < 0 || off > PrecisionTrackHalf {
				t.Fatalf("distance %d outside 0…%d", off, PrecisionTrackHalf)
			}
		}
	}
}

// A perfect stop is the whole point of the game, so it has to be reachable
// through the real scoring path rather than merely legal in the abstract.
func TestScorePrecisionStop_ScoresAPerfectStop(t *testing.T) {
	// A quarter of a sweep after the start the marker is dead centre. With a
	// zero phase that means stopping at exactly period/4.
	ch := challengeFor(t, 0, PrecisionSweepPeriodMs)
	got, err := ScorePrecisionStop([]int{PrecisionSweepPeriodMs / 4}, PrecisionDurationMs, ch)
	if err != nil {
		t.Fatalf("a perfect stop must be accepted, got %v", err)
	}
	if got != 0 {
		t.Fatalf("stopping dead centre should score 0, got %d", got)
	}
}

// The phase is the entire reason the challenge is stored. If it were ignored,
// every round would score as though it began at the left edge.
func TestScorePrecisionStop_HonoursThePhase(t *testing.T) {
	// With a phase of period/4 the marker STARTS at centre, so stopping
	// immediately is the perfect round and stopping a quarter-sweep later is the
	// worst one.
	ch := challengeFor(t, PrecisionSweepPeriodMs/4, PrecisionSweepPeriodMs)
	perfect, err := ScorePrecisionStop([]int{0}, PrecisionDurationMs, ch)
	if err != nil {
		t.Fatalf("stop at 0 rejected: %v", err)
	}
	if perfect != 0 {
		t.Fatalf("a phase starting at centre should make an instant stop perfect, got %d", perfect)
	}
	worst, err := ScorePrecisionStop([]int{PrecisionSweepPeriodMs / 4}, PrecisionDurationMs, ch)
	if err != nil {
		t.Fatalf("stop at a quarter sweep rejected: %v", err)
	}
	if worst != PrecisionTrackHalf {
		t.Fatalf("that stop should land at the far end, got %d", worst)
	}
}

// A player who never stops the marker is an ordinary outcome, not a malformed
// submission — the client's own clock-expiry path has always scored it as the
// worst legal distance and the server must agree.
func TestScorePrecisionStop_NoStopIsATimeoutNotAnError(t *testing.T) {
	got, err := ScorePrecisionStop(nil, PrecisionDurationMs, challengeFor(t, 0, PrecisionSweepPeriodMs))
	if err != nil {
		t.Fatalf("a round with no stop is a timeout, not a rejection: %v", err)
	}
	if got != PrecisionTrackHalf {
		t.Fatalf("a timeout should score the worst legal distance %d, got %d", PrecisionTrackHalf, got)
	}
	// And it must not need a challenge to say so: there is no sweep to replay.
	if got, err := ScorePrecisionStop([]int{}, PrecisionDurationMs, nil); err != nil || got != PrecisionTrackHalf {
		t.Fatalf("a timeout with no challenge should still score %d, got %d (%v)", PrecisionTrackHalf, got, err)
	}
}

func TestScorePrecisionStop_RejectsImpossibleRounds(t *testing.T) {
	ch := challengeFor(t, 0, PrecisionSweepPeriodMs)
	cases := []struct {
		name       string
		events     []int
		durationMs int
		challenge  []byte
	}{
		{"two stops", []int{100, 200}, PrecisionDurationMs, ch},
		{"a stop after the round ended", []int{PrecisionDurationMs + 1}, PrecisionDurationMs, ch},
		{"a negative stop", []int{-1}, PrecisionDurationMs, ch},
		{"no round at all", []int{100}, 0, ch},
		// The whole point of storing the challenge: without one there is no
		// sweep to replay, and guessing at a phase would score the player
		// against a round they never played.
		{"no challenge", []int{100}, PrecisionDurationMs, nil},
		{"an unreadable challenge", []int{100}, PrecisionDurationMs, []byte("{not json")},
		{"a challenge with no period", []int{100}, PrecisionDurationMs, challengeFor(t, 0, 0)},
		{"a phase outside its own sweep", []int{100}, PrecisionDurationMs, challengeFor(t, PrecisionSweepPeriodMs, PrecisionSweepPeriodMs)},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if _, err := ScorePrecisionStop(c.events, c.durationMs, c.challenge); err == nil {
				t.Fatal("expected a rejection")
			}
		})
	}
}

// The challenge the definition hands out must be one its own scorer accepts.
// These two agreeing is not automatic — precisionChallengeOf rejects a phase at
// or beyond the period, so an off-by-one in the draw's bound would reject every
// round that happened to draw the top value.
func TestPrecisionChallenge_IsAlwaysScorable(t *testing.T) {
	def, ok := DefaultRegistry().Get(SlugPrecisionStop)
	if !ok {
		t.Fatal("precision-stop should be registered")
	}
	if def.Challenge == nil {
		t.Fatal("precision-stop must issue a challenge; its score cannot be replayed without one")
	}
	if def.Scorer == nil {
		t.Fatal("precision-stop must have a Scorer rather than a Validator")
	}
	if def.Validator != nil {
		t.Fatal("a game the server scores must not also carry a validator for a value nobody sends")
	}

	// Both ends of the draw's range, which is where a bound error would hide.
	for _, draw := range []Draw{
		func(int) int { return 0 },
		func(n int) int { return n - 1 },
	} {
		raw, err := json.Marshal(def.Challenge(draw))
		if err != nil {
			t.Fatalf("marshal challenge: %v", err)
		}
		if _, err := def.Scorer([]int{123}, def.Game.DurationMs, raw); err != nil {
			t.Fatalf("the definition issued a challenge its own scorer rejects: %v (%s)", err, raw)
		}
	}
}
