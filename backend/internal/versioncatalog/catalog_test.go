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
	mutatedEvidenceID := ""
	mutatedRankID := ""
	for index := range first {
		if mutatedEvidenceID == "" && first[index].RankEvidence != nil {
			mutatedEvidenceID = first[index].ID
			first[index].RankEvidence.NoteZh = "mutated"
		}
		if mutatedRankID == "" && first[index].Ranks["CN"][0] != nil {
			mutatedRankID = first[index].ID
			*first[index].Ranks["CN"][0] = 999
		}
	}
	second := List()
	if len(second[0].AppHours) != len(defaultAppLines) {
		t.Fatal("catalog app lines leaked caller mutation")
	}
	if _, ok := second[0].Ranks["CN"]; !ok {
		t.Fatal("catalog ranks leaked caller mutation")
	}
	for _, version := range second {
		if version.ID == mutatedEvidenceID && version.RankEvidence.NoteZh == "mutated" {
			t.Fatal("catalog evidence leaked caller mutation")
		}
		if version.ID == mutatedRankID && version.Ranks["CN"][0] != nil && *version.Ranks["CN"][0] == 999 {
			t.Fatal("catalog rank pointer leaked caller mutation")
		}
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

func TestCatalogAppliesSeparatedHistoricalObservations(t *testing.T) {
	versions := List()
	byID := make(map[string]Version, len(versions))
	for _, version := range versions {
		byID[version.ID] = version
	}

	genshin := byID["catalog-genshin-55-p1"]
	if genshin.Ranks["CN"][0] == nil || *genshin.Ranks["CN"][0] != 9 || genshin.RankEvidence == nil {
		t.Fatalf("missing separated Genshin observation: %+v", genshin)
	}
	wuwa := byID["catalog-wuwa-28-p1"]
	hours := map[string]float64{}
	for _, line := range wuwa.AppHours {
		if line.Hours != nil {
			hours[line.AppID] = *line.Hours
		}
	}
	if hours["baidu_netdisk"] != 18 || hours["quark"] != 51 {
		t.Fatalf("missing separated Wuwa app-line observations: %+v", wuwa.AppHours)
	}

	zzz := byID["catalog-zzz-11-p2"]
	if zzz.Ranks["CN"][0] == nil || *zzz.Ranks["CN"][0] != 8 || zzz.Ranks["JP"][0] == nil || *zzz.Ranks["JP"][0] != 1 {
		t.Fatalf("missing early ZZZ observation: %+v", zzz.Ranks)
	}

	earlyGenshin := byID["catalog-genshin-41-p1"]
	foundDouyin := false
	for _, line := range earlyGenshin.AppHours {
		if line.AppID == "douyin" && line.Hours != nil && *line.Hours == 63 && line.DataStatus == "public_video_summary" {
			foundDouyin = true
		}
	}
	if !foundDouyin {
		t.Fatalf("missing early Genshin app-line observation: %+v", earlyGenshin.AppHours)
	}

	furina := byID["catalog-genshin-42-p1"]
	if furina.Ranks["CN"][0] == nil || *furina.Ranks["CN"][0] != 1 || furina.Ranks["JP"][0] == nil || *furina.Ranks["JP"][0] != 1 {
		t.Fatalf("missing Genshin 4.2 rank observations: %+v", furina.Ranks)
	}
	if hoursForApp(furina, "douyin") != 81 {
		t.Fatalf("missing Genshin 4.2 Douyin duration: %+v", furina.AppHours)
	}

	acheron := byID["catalog-hsr-21-p1"]
	if acheron.Ranks["CN"][0] == nil || *acheron.Ranks["CN"][0] != 1 || acheron.Ranks["KR"][0] == nil || *acheron.Ranks["KR"][0] != 1 {
		t.Fatalf("missing HSR 2.1 rank observations: %+v", acheron.Ranks)
	}
	if hoursForApp(acheron, "douyin") != 81 {
		t.Fatalf("missing HSR 2.1 Douyin duration: %+v", acheron.AppHours)
	}

	ruanMei := byID["catalog-hsr-16-p1"]
	if hoursForApp(ruanMei, "douyin") != 33 {
		t.Fatalf("missing HSR 1.6 Douyin duration: %+v", ruanMei.AppHours)
	}

	aglaea := byID["catalog-hsr-30-p2"]
	if aglaea.Ranks["CN"][0] == nil || *aglaea.Ranks["CN"][0] != 13 || aglaea.Ranks["JP"][0] == nil || *aglaea.Ranks["JP"][0] != 2 {
		t.Fatalf("missing HSR 3.0 second-half rank observations: %+v", aglaea.Ranks)
	}

	mavuika := byID["catalog-genshin-53-p1"]
	if mavuika.Ranks["CN"][0] == nil || *mavuika.Ranks["CN"][0] != 4 || mavuika.Ranks["US"][0] == nil || *mavuika.Ranks["US"][0] != 11 {
		t.Fatalf("missing Genshin 5.3 first-half rank observations: %+v", mavuika.Ranks)
	}
	nahida := byID["catalog-genshin-51-p2"]
	if hoursForApp(nahida, "baidu_netdisk") != 12 {
		t.Fatalf("missing Genshin 5.1 second-half app-line duration: %+v", nahida.AppHours)
	}
	camellya := byID["catalog-wuwa-14-p1"]
	if camellya.Ranks["KR"][0] == nil || *camellya.Ranks["KR"][0] != 5 {
		t.Fatalf("missing Wuwa 1.4 Korean rank observation: %+v", camellya.Ranks)
	}
	shorekeeper := byID["catalog-wuwa-26-p2"]
	if ranks, exists := shorekeeper.Ranks["US"]; exists && (ranks[0] != nil || ranks[1] != nil) {
		t.Fatalf("cloud-game rank must not be stored as a US rank: %+v", shorekeeper.Ranks)
	}
}

func hoursForApp(version Version, appID string) float64 {
	for _, line := range version.AppHours {
		if line.AppID == appID && line.Hours != nil {
			return *line.Hours
		}
	}
	return -1
}
