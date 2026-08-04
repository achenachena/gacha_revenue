package versioncatalog

import "testing"

func TestCatalogContainsCompleteLocalizedPhaseDirectory(t *testing.T) {
	versions := List()
	if len(versions) != 256 {
		t.Fatalf("expected 256 phase entries, got %d", len(versions))
	}
	found := false
	for _, version := range versions {
		if version.ID != "hsr-44-p1" {
			continue
		}
		found = true
		if version.CharactersZh != "姬子·新星、斯帕克希、长夜月、丹恒·腾荒" {
			t.Fatalf("unexpected Chinese character names: %q", version.CharactersZh)
		}
	}
	if !found {
		t.Fatal("missing known current phase")
	}
}

func TestListReturnsIndependentMapsAndSlices(t *testing.T) {
	first := List()
	first[0].Ranks["CN"] = [2]*int{}
	first[0].AppHours = nil
	second := List()
	if len(second[0].AppHours) != len(defaultAppLines) {
		t.Fatal("catalog app lines leaked caller mutation")
	}
	if _, ok := second[0].Ranks["CN"]; !ok {
		t.Fatal("catalog ranks leaked caller mutation")
	}
}
