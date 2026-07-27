package game

import "testing"

// perfectDrop returns the moment to drop block `placed` so it lands exactly on
// a tower whose centre is `towerCentre` — i.e. the phase at which the sliding
// block's centre coincides with it.
//
// The test needs this because a Stack round cannot be written down as literal
// timings: block n's sweep begins when block n-1 was dropped, so every timing
// depends on every timing before it. Searching the sweep for the right moment
// is how a PLAYER solves it too, which makes these tests read as rounds rather
// than as magic numbers.
func perfectDrop(spawnedAt, towerCentre, width, placed int) int {
	period := StackPeriodMs(placed)
	best, bestOff := spawnedAt+1, StackTrackWidth
	for phase := 1; phase <= period; phase++ {
		centre := StackBlockCentre(phase, width, period, placed%2 == 0)
		off := centre - towerCentre
		if off < 0 {
			off = -off
		}
		if off < bestOff {
			best, bestOff = spawnedAt+phase, off
		}
	}
	return best
}

func TestStackBlockCentreSweepsTheTrackAndTurnsAround(t *testing.T) {
	const width = StackBaseWidth
	period := StackBasePeriodMs
	travel := StackTrackWidth - width

	// A block entering from the left starts hard against the left edge...
	if got, want := StackBlockCentre(0, width, period, true), width/2; got != want {
		t.Fatalf("phase 0 from left = %d, want %d", got, want)
	}
	// ...reaches the far edge at the turn...
	if got, want := StackBlockCentre(period/2, width, period, true), width/2+travel; got != want {
		t.Fatalf("phase half from left = %d, want %d", got, want)
	}
	// ...and is back where it began after a full sweep.
	if got, want := StackBlockCentre(period, width, period, true), width/2; got != want {
		t.Fatalf("phase full from left = %d, want %d", got, want)
	}

	// Entering from the right is the mirror image, which is what stops an
	// instant re-drop from banking a free perfect block.
	if got, want := StackBlockCentre(0, width, period, false), width/2+travel; got != want {
		t.Fatalf("phase 0 from right = %d, want %d", got, want)
	}
}

func TestStackBlockCentreNeverLeavesTheTrack(t *testing.T) {
	for _, width := range []int{1, 7, StackBaseWidth, StackTrackWidth - 1, StackTrackWidth} {
		for phase := 0; phase <= StackBasePeriodMs*2; phase += 7 {
			for _, fromLeft := range []bool{true, false} {
				centre := StackBlockCentre(phase, width, StackBasePeriodMs, fromLeft)
				if centre-width/2 < 0 || centre+width/2 > StackTrackWidth {
					t.Fatalf("width %d phase %d fromLeft %v: block spans [%d,%d], off a %d-wide track",
						width, phase, fromLeft, centre-width/2, centre+width/2, StackTrackWidth)
				}
			}
		}
	}
}

func TestScoreStackCountsAPerfectRun(t *testing.T) {
	// Play five blocks, each dropped at the moment it sits over the tower.
	// A perfect run trims nothing, so the tower must still be full width.
	centre := StackTrackWidth / 2
	drops := []int{}
	spawnedAt := 0
	for i := range 5 {
		at := perfectDrop(spawnedAt, centre, StackBaseWidth, i)
		drops = append(drops, at)
		spawnedAt = at
	}

	got, err := ScoreStack(drops, StackDurationMs, nil)
	if err != nil {
		t.Fatalf("perfect run rejected: %v", err)
	}
	if got != len(drops) {
		t.Fatalf("perfect run scored %d, want %d", got, len(drops))
	}
}

func TestScoreStackStopsAtTheFirstMiss(t *testing.T) {
	// One good drop, then a drop taken the instant the next block appears —
	// which is at the opposite edge, nowhere near the tower.
	first := perfectDrop(0, StackTrackWidth/2, StackBaseWidth, 0)
	drops := []int{first, first + 1, first + 400, first + 800}

	got, err := ScoreStack(drops, StackDurationMs, nil)
	if err != nil {
		t.Fatalf("a miss is an outcome, not an error: %v", err)
	}
	if got != 1 {
		t.Fatalf("scored %d, want 1 — the round ended on the second drop", got)
	}
}

func TestScoreStackTrimsTheTowerOnAnImperfectDrop(t *testing.T) {
	// Drop the first block noticeably off-centre, then drop the second one
	// perfectly onto where the tower now is. The second must still land — the
	// trim narrows the tower, it does not end the round.
	period := StackPeriodMs(0)
	towerLeft := (StackTrackWidth - StackBaseWidth) / 2

	// Search the sweep for a drop that overlaps the tower without covering it.
	// Searching rather than naming a phase because the two are only a specific
	// number apart until someone retunes the ramp — and a quarter-sweep, the
	// obvious guess, lands exactly on centre and trims nothing at all.
	at, overlapLeft, overlapRight := 0, 0, 0
	for phase := 1; phase < period; phase++ {
		centre := StackBlockCentre(phase, StackBaseWidth, period, true)
		blockLeft := centre - StackBaseWidth/2
		l := max(towerLeft, blockLeft)
		r := min(towerLeft+StackBaseWidth, blockLeft+StackBaseWidth)
		if r > l && r-l < StackBaseWidth {
			at, overlapLeft, overlapRight = phase, l, r
			break
		}
	}
	if at == 0 {
		t.Fatal("test setup: no phase in the sweep trims the tower without missing it")
	}
	newWidth := overlapRight - overlapLeft

	second := perfectDrop(at, (overlapLeft+overlapRight)/2, newWidth, 1)
	got, err := ScoreStack([]int{at, second}, StackDurationMs, nil)
	if err != nil {
		t.Fatalf("trimmed run rejected: %v", err)
	}
	if got != 2 {
		t.Fatalf("scored %d, want 2 — a trim narrows the tower but does not end the round", got)
	}
}

func TestScoreStackRejectsMalformedEvents(t *testing.T) {
	cases := []struct {
		name  string
		drops []int
	}{
		{"a drop before the round began", []int{-1}},
		{"a drop after the round ended", []int{StackDurationMs + 1}},
		{"drops out of order", []int{800, 400}},
		{"two drops at the same instant", []int{400, 400}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if _, err := ScoreStack(c.drops, StackDurationMs, nil); err == nil {
				t.Fatalf("%v was accepted, want a rejection", c.drops)
			}
		})
	}

	tooMany := make([]int, StackMaxDrops+1)
	for i := range tooMany {
		tooMany[i] = i + 1
	}
	if _, err := ScoreStack(tooMany, StackDurationMs, nil); err == nil {
		t.Fatal("a submission longer than StackMaxDrops was accepted")
	}
}

func TestScoreStackScoresAnEmptyRoundZero(t *testing.T) {
	// A player who never drops anything is not cheating, they just did nothing.
	got, err := ScoreStack(nil, StackDurationMs, nil)
	if err != nil {
		t.Fatalf("an empty round is an outcome, not an error: %v", err)
	}
	if got != 0 {
		t.Fatalf("empty round scored %d, want 0", got)
	}
}

func TestStackPeriodRampsDownToItsFloor(t *testing.T) {
	if got := StackPeriodMs(0); got != StackBasePeriodMs {
		t.Fatalf("first block period = %d, want %d", got, StackBasePeriodMs)
	}
	if got, want := StackPeriodMs(1), StackBasePeriodMs-StackPeriodStepMs; got != want {
		t.Fatalf("second block period = %d, want %d", got, want)
	}
	// Far enough in that the ramp would go negative if it were not floored.
	if got := StackPeriodMs(1000); got != StackMinPeriodMs {
		t.Fatalf("late block period = %d, want the floor %d", got, StackMinPeriodMs)
	}
}
