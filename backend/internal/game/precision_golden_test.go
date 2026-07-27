package game

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// precisionGoldenPath is read by BOTH suites, the same arrangement stack_golden
// established: the Go side generates and verifies it, and the TypeScript mirror
// (packages/player-core/src/games/precision.test.ts) reads the same file and
// asserts its own sweep produces the same numbers.
//
// Regenerate with the same flag as the stack fixture:
//
//	go test ./internal/game -run Golden -update
const precisionGoldenPath = "testdata/precision_golden.json"

type precisionSweepCase struct {
	ElapsedMs int `json:"elapsedMs"`
	PhaseMs   int `json:"phaseMs"`
	PeriodMs  int `json:"periodMs"`
	Position  int `json:"position"`
	Off       int `json:"off"`
}

type precisionRoundCase struct {
	StopMs  []int `json:"stopMs"`
	PhaseMs int   `json:"phaseMs"`
	Score   int   `json:"score"`
}

type precisionGolden struct {
	DurationMs int                  `json:"durationMs"`
	PeriodMs   int                  `json:"periodMs"`
	TrackHalf  int                  `json:"trackHalf"`
	Sweeps     []precisionSweepCase `json:"sweeps"`
	Rounds     []precisionRoundCase `json:"rounds"`
}

func buildPrecisionGolden(t *testing.T) precisionGolden {
	t.Helper()
	g := precisionGolden{
		DurationMs: PrecisionDurationMs,
		PeriodMs:   PrecisionSweepPeriodMs,
		TrackHalf:  PrecisionTrackHalf,
	}

	// Elapsed times either side of the turn and past a full sweep, phases across
	// the whole draw range including both ends, and a period off the default —
	// the combinations where a truncating division could land differently in two
	// languages. The odd numbers are deliberate: round values divide exactly and
	// would hide precisely the rounding disagreement this fixture exists to
	// catch.
	for _, elapsed := range []int{0, 1, 13, 349, 350, 351, 700, 701, 1049, 1399, 1400, 1401, 2837, 5999} {
		for _, phase := range []int{0, 1, 173, 700, 1013, 1399} {
			for _, period := range []int{PrecisionSweepPeriodMs, 900} {
				pos := PrecisionSweepPosition(elapsed, phase, period)
				g.Sweeps = append(g.Sweeps, precisionSweepCase{
					ElapsedMs: elapsed, PhaseMs: phase, PeriodMs: period,
					Position: pos, Off: PrecisionMissDistance(pos),
				})
			}
		}
	}

	for _, r := range []struct {
		stops []int
		phase int
	}{
		{[]int{}, 0},
		{[]int{0}, 0},
		{[]int{PrecisionSweepPeriodMs / 4}, 0},
		{[]int{350}, 173},
		{[]int{1234}, 1013},
		{[]int{PrecisionDurationMs}, 700},
		{[]int{4567}, 1399},
	} {
		score, err := ScorePrecisionStop(r.stops, PrecisionDurationMs, challengeFor(t, r.phase, PrecisionSweepPeriodMs))
		if err != nil {
			t.Fatalf("golden round %v (phase %d) rejected: %v", r.stops, r.phase, err)
		}
		g.Rounds = append(g.Rounds, precisionRoundCase{StopMs: r.stops, PhaseMs: r.phase, Score: score})
	}
	return g
}

// TestPrecisionGoldenFixtureIsCurrent pins the two Precision Stop simulations to
// each other, for the same reason TestStackGoldenFixtureIsCurrent pins Stack's.
//
// The failure it exists to prevent is specific and invisible from the outside: a
// player watches the marker freeze dead centre and the result screen tells them
// they were eleven off, because the client's triangle wave and the server's
// rounded one integer differently. Nothing about that reproduces from a log.
//
// So changing the sweep is a three-part edit that cannot be done by halves — the
// Go, the TypeScript, and a regenerated fixture — and forgetting any one of them
// fails a build rather than a storefront.
func TestPrecisionGoldenFixtureIsCurrent(t *testing.T) {
	want, err := json.MarshalIndent(buildPrecisionGolden(t), "", "  ")
	if err != nil {
		t.Fatalf("encode golden: %v", err)
	}
	want = append(want, '\n')

	if *updateGolden {
		if err := os.MkdirAll(filepath.Dir(precisionGoldenPath), 0o755); err != nil {
			t.Fatalf("create testdata: %v", err)
		}
		if err := os.WriteFile(precisionGoldenPath, want, 0o644); err != nil {
			t.Fatalf("write golden: %v", err)
		}
		t.Logf("wrote %s", precisionGoldenPath)
		return
	}

	got, err := os.ReadFile(precisionGoldenPath)
	if err != nil {
		t.Fatalf("read golden (regenerate with `go test ./internal/game -run Golden -update`): %v", err)
	}
	if string(got) != string(want) {
		t.Fatalf("%s is stale — the sweep changed but the fixture did not.\n"+
			"Regenerate with `go test ./internal/game -run Golden -update`, then check "+
			"packages/player-core/src/games/precision.ts still agrees with it.", precisionGoldenPath)
	}
}
