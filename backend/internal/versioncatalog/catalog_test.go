package versioncatalog

import (
	"strings"
	"testing"
	"time"
)

func TestCatalogContainsCompleteLocalizedPhaseDirectory(t *testing.T) {
	versions := List()
	if len(versions) != 256 {
		t.Fatalf("expected 256 phase entries, got %d", len(versions))
	}
	found := false
	calendarGames := map[string]bool{"genshin": true, "hsr": true, "zzz": true, "wuwa": true}
	for _, version := range versions {
		if strings.Contains(version.CharactersZh, "•") {
			t.Fatalf("uncorrected Chinese separator in %+v", version)
		}
		for _, invalid := range []string{"迷迷", "Myday", "秧秧·霜伶", "岁岁", "卢克·赫尔森", "西格莉塔", "绯优", "德妮雅", "露西拉"} {
			if strings.Contains(version.CharactersZh+version.CharactersEn, invalid) {
				t.Fatalf("uncorrected localized character alias %q in %+v", invalid, version)
			}
		}
		if calendarGames[version.GameID] && (version.StartsAt == "" || version.EndsAt == "" || version.CharactersZh == "角色待补充" || version.SourceURL == "") {
			t.Fatalf("incomplete public calendar phase: %+v", version)
		}
		if calendarGames[version.GameID] {
			start, startErr := time.Parse("2006-01-02", version.StartsAt)
			end, endErr := time.Parse("2006-01-02", version.EndsAt)
			if startErr != nil || endErr != nil || !end.After(start) {
				t.Fatalf("invalid calendar window: %+v", version)
			}
		}
		if version.ID != "hsr-44-p1" {
			continue
		}
		found = true
		if version.CharactersZh != "姬子·启行" {
			t.Fatalf("unexpected Chinese character names: %q", version.CharactersZh)
		}
	}
	if !found {
		t.Fatal("missing known current phase")
	}
}

func TestMergeEnrichesExistingPhaseWithoutDiscardingOwnerEvidence(t *testing.T) {
	hours := 18.0
	base := []Version{{
		ID: "owner-id", GameID: "wuwa", Version: "2.4", PhaseIndex: 1,
		CharactersZh: "旧名称", AppHours: []AppLineObservation{{AppID: "tencent_video", Hours: &hours}},
	}}
	updates := []Version{{
		ID: "provider-id", GameID: "wuwa", Version: "2.4", PhaseIndex: 1,
		CharactersZh: "卡提希娅", StartsAt: "2025-06-12", EndsAt: "2025-07-03", SourceURL: "https://example.com/calendar",
	}}
	merged := Merge(base, updates)
	if len(merged) != 1 || merged[0].ID != "owner-id" || merged[0].CharactersZh != "卡提希娅" || merged[0].StartsAt == "" || merged[0].AppHours[0].Hours == nil || *merged[0].AppHours[0].Hours != 18 {
		t.Fatalf("unexpected merged phase: %+v", merged)
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

func TestCatalogKeepsSourcedRecentObservations(t *testing.T) {
	versions := List()
	byID := make(map[string]Version, len(versions))
	for _, version := range versions {
		byID[version.ID] = version
	}

	zzz := byID["zzz-28-p1"]
	if zzz.Ranks["CN"][0] == nil || *zzz.Ranks["CN"][0] != 39 || zzz.RankEvidence == nil {
		t.Fatalf("missing sourced ZZZ 2.8 observation: %+v", zzz)
	}
	nte := byID["nte-12-p1"]
	if nte.Ranks["US"][0] == nil || *nte.Ranks["US"][0] != 153 {
		t.Fatalf("missing sourced NTE 1.2 international observation: %+v", nte)
	}
	foundQuark := false
	for _, line := range nte.AppHours {
		if line.AppID == "quark" && line.Hours != nil && *line.Hours == 6 && line.Evidence != nil {
			foundQuark = true
		}
	}
	if !foundQuark {
		t.Fatalf("missing sourced NTE Quark duration: %+v", nte.AppHours)
	}
}
