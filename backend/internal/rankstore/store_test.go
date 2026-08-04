package rankstore

import (
	"testing"
	"time"
)

func TestMonthsBetweenIncludesEachTouchedPartition(t *testing.T) {
	start := time.Date(2026, 1, 31, 12, 0, 0, 0, time.UTC)
	end := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)
	months := monthsBetween(start, end)
	if len(months) != 2 || months[0].Month() != time.January || months[1].Month() != time.February {
		t.Fatalf("unexpected month partitions: %+v", months)
	}
}
