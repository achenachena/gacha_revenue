package revenuesource

import "testing"

func TestParseUsesPublishedTotals(t *testing.T) {
	body := `before \"revenueHistory\":[{\"year\":2026,\"month\":5,\"revenue_total\":3876500000},{\"year\":2026,\"month\":4,\"revenue_total\":5810000000}] after`
	history, err := Parse(body)
	if err != nil {
		t.Fatal(err)
	}
	if len(history) != 2 || history[0].Year != 2026 || history[0].Month != 4 || history[0].Value != 58.1 || history[1].Value != 38.765 {
		t.Fatalf("unexpected public revenue history: %+v", history)
	}
}

func TestParseRejectsDuplicateMonths(t *testing.T) {
	body := `\"revenueHistory\":[{\"year\":2026,\"month\":4,\"revenue_total\":5810000000},{\"year\":2026,\"month\":4,\"revenue_total\":3876500000}]`
	if _, err := Parse(body); err == nil {
		t.Fatal("expected duplicate source month to be rejected")
	}
}

func TestParseRejectsImplausibleRevenueTotals(t *testing.T) {
	body := `\"revenueHistory\":[{\"year\":2026,\"month\":4,\"revenue_total\":1000100000000}]`
	if _, err := Parse(body); err == nil {
		t.Fatal("expected implausible source total to be rejected")
	}
}
