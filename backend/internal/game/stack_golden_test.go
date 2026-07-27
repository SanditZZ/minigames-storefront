package game

import (
	"encoding/json"
	"flag"
	"os"
	"path/filepath"
	"testing"
)

// updateGolden regenerates the fixtures instead of checking them. Shared by
// every golden test in this package, so one flag rewrites them all:
//
//	go test ./internal/game -run Golden -update
var updateGolden = flag.Bool("update", false, "rewrite the golden fixtures")

// goldenPath is read by BOTH suites. The Go side generates and verifies it; the
// TypeScript mirror (packages/player-core/src/games/stack.test.ts) reads the
// same file and asserts its own simulation produces the same numbers.
const goldenPath = "testdata/stack_golden.json"

type stackCentreCase struct {
	Phase    int  `json:"phase"`
	Width    int  `json:"width"`
	Period   int  `json:"period"`
	FromLeft bool `json:"fromLeft"`
	Centre   int  `json:"centre"`
}

type stackRoundCase struct {
	Drops []int `json:"drops"`
	Score int   `json:"score"`
}

type stackGolden struct {
	DurationMs int               `json:"durationMs"`
	Centres    []stackCentreCase `json:"centres"`
	Rounds     []stackRoundCase  `json:"rounds"`
}

func buildStackGolden(t *testing.T) stackGolden {
	t.Helper()
	g := stackGolden{DurationMs: StackDurationMs}

	// A spread of widths (full base through nearly the whole track), phases
	// either side of the turn and past a full sweep, every period on the ramp,
	// and both entry sides — the combinations where a truncating division could
	// plausibly land differently in two languages.
	for _, w := range []int{300, 187, 64, 999} {
		for _, phase := range []int{0, 37, 211, 450, 900, 1337, 1799, 2600} {
			for _, period := range []int{StackBasePeriodMs, 1260, StackMinPeriodMs} {
				for _, fromLeft := range []bool{true, false} {
					g.Centres = append(g.Centres, stackCentreCase{
						Phase: phase, Width: w, Period: period, FromLeft: fromLeft,
						Centre: StackBlockCentre(phase, w, period, fromLeft),
					})
				}
			}
		}
	}

	for _, drops := range [][]int{
		{},
		{450},
		{450, 1200},
		{900, 1700, 2400, 3000},
		{123, 456, 789, 1011, 1213, 1415},
		{1, 2, 3},
		{StackDurationMs - 1},
	} {
		score, err := ScoreStack(drops, StackDurationMs, nil)
		if err != nil {
			t.Fatalf("golden round %v rejected: %v", drops, err)
		}
		g.Rounds = append(g.Rounds, stackRoundCase{Drops: drops, Score: score})
	}
	return g
}

// TestStackGoldenFixtureIsCurrent keeps the two simulations honest.
//
// Stack is scored on the server and rendered on the client, so its physics are
// necessarily written twice — once in stack.go, once in player-core's stack.ts.
// The failure that duplication invites is not a wrong number in a log: it is a
// player watching a block land squarely on the tower and being told they
// missed. Nothing about that reproduces from the outside.
//
// So the pair is pinned to a shared fixture, the same arrangement theme.css
// already has with packages/tokens: this side GENERATES it and fails when the
// committed copy drifts, the TypeScript side READS it and fails when its own
// maths disagrees. Changing the physics is then a three-part edit that cannot
// be done by halves — the Go, the TypeScript, and a regenerated fixture — and
// forgetting any one of them fails a build rather than a storefront.
func TestStackGoldenFixtureIsCurrent(t *testing.T) {
	want, err := json.MarshalIndent(buildStackGolden(t), "", "  ")
	if err != nil {
		t.Fatalf("encode golden: %v", err)
	}
	want = append(want, '\n')

	if *updateGolden {
		if err := os.MkdirAll(filepath.Dir(goldenPath), 0o755); err != nil {
			t.Fatalf("create testdata: %v", err)
		}
		if err := os.WriteFile(goldenPath, want, 0o644); err != nil {
			t.Fatalf("write golden: %v", err)
		}
		t.Logf("wrote %s", goldenPath)
		return
	}

	got, err := os.ReadFile(goldenPath)
	if err != nil {
		t.Fatalf("read golden (regenerate with `go test ./internal/game -run Golden -update`): %v", err)
	}
	if string(got) != string(want) {
		t.Fatalf("%s is stale — the physics changed but the fixture did not.\n"+
			"Regenerate with `go test ./internal/game -run Golden -update`, then check "+
			"packages/player-core/src/games/stack.ts still agrees with it.", goldenPath)
	}
}
