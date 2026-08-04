package revenuestore

import (
	"context"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"

	"gacha-revenue/backend/internal/revenue"
)

type fakeDynamo struct {
	put   *dynamodb.PutItemInput
	items []map[string]any
}

func (client *fakeDynamo) PutItem(_ context.Context, input *dynamodb.PutItemInput, _ ...func(*dynamodb.Options)) (*dynamodb.PutItemOutput, error) {
	client.put = input
	return &dynamodb.PutItemOutput{}, nil
}

func (client *fakeDynamo) Query(_ context.Context, _ *dynamodb.QueryInput, _ ...func(*dynamodb.Options)) (*dynamodb.QueryOutput, error) {
	output := &dynamodb.QueryOutput{}
	for _, item := range client.items {
		encoded, err := attributevalue.MarshalMap(item)
		if err != nil {
			return nil, err
		}
		output.Items = append(output.Items, encoded)
	}
	return output, nil
}

func TestPutStoresDurableValidatedHistoryWithoutTTL(t *testing.T) {
	client := &fakeDynamo{}
	store := New(client, "table")
	history := revenue.GameHistory{
		GameID: "hsr", History: []revenue.Month{{Year: 2026, Month: 7, Value: 42}},
		SourceFetchedAt: time.Date(2026, 8, 4, 0, 0, 0, 0, time.UTC),
	}
	if err := store.Put(context.Background(), history); err != nil {
		t.Fatal(err)
	}
	if client.put == nil {
		t.Fatal("expected DynamoDB write")
	}
	var item map[string]any
	if err := attributevalue.UnmarshalMap(client.put.Item, &item); err != nil {
		t.Fatal(err)
	}
	if item["pk"] != partitionKey || item["sk"] != "hsr" || item["expires_at"] != nil {
		t.Fatalf("unexpected durable item: %+v", item)
	}
}

func TestListValidatesAndDecodesStoredHistories(t *testing.T) {
	payload := `{"game_id":"hsr","history":[{"year":2026,"month":7,"value":42}],"source_url":"https://example.com","source_fetched_at":"2026-08-04T00:00:00Z","source_status":"live_public_source"}`
	client := &fakeDynamo{items: []map[string]any{{"pk": partitionKey, "sk": "hsr", "payload": payload}}}
	histories, err := New(client, "table").List(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(histories) != 1 || histories[0].GameID != "hsr" || histories[0].History[0].Value != 42 {
		t.Fatalf("unexpected histories: %+v", histories)
	}
}
