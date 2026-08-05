package rankstore

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

const sortKeyLayout = "2006-01-02T15:04:05Z"

// LegacyFeedLimit is the depth of snapshots written before feed_limit was
// persisted. Apple's public grossing RSS currently returns at most 100 rows.
const LegacyFeedLimit = 100

// MarketSnapshot contains only tracked subjects found in the source response.
// FeedLimit records the actual response depth so consumers never confuse a
// Top 100 miss with a Top 200 miss.
type MarketSnapshot struct {
	FeedLimit int            `json:"feed_limit,omitempty"`
	Games     map[string]int `json:"games"`
	AppLines  map[string]int `json:"app_lines,omitempty"`
}

func VisibleLimit(snapshot MarketSnapshot) int {
	if snapshot.FeedLimit > 0 {
		return snapshot.FeedLimit
	}
	return LegacyFeedLimit
}

type Snapshot struct {
	ObservedHour time.Time                 `json:"observed_hour"`
	Markets      map[string]MarketSnapshot `json:"markets"`
}

type dynamoItem struct {
	PK        string `dynamodbav:"pk"`
	SK        string `dynamodbav:"sk"`
	Payload   string `dynamodbav:"payload"`
	ExpiresAt int64  `dynamodbav:"expires_at"`
}

type dynamoAPI interface {
	PutItem(context.Context, *dynamodb.PutItemInput, ...func(*dynamodb.Options)) (*dynamodb.PutItemOutput, error)
	Query(context.Context, *dynamodb.QueryInput, ...func(*dynamodb.Options)) (*dynamodb.QueryOutput, error)
}

type Store struct {
	client    dynamoAPI
	tableName string
}

func New(client dynamoAPI, tableName string) *Store {
	return &Store{client: client, tableName: tableName}
}

func (s *Store) PutSnapshot(ctx context.Context, snapshot Snapshot) error {
	if snapshot.ObservedHour.IsZero() {
		return fmt.Errorf("observed hour is required")
	}
	snapshot.ObservedHour = snapshot.ObservedHour.UTC().Truncate(time.Hour)
	payload, err := json.Marshal(snapshot)
	if err != nil {
		return fmt.Errorf("encode rank snapshot: %w", err)
	}
	item, err := attributevalue.MarshalMap(dynamoItem{
		PK:        partitionKey(snapshot.ObservedHour),
		SK:        snapshot.ObservedHour.Format(sortKeyLayout),
		Payload:   string(payload),
		ExpiresAt: snapshot.ObservedHour.AddDate(0, 13, 0).Unix(),
	})
	if err != nil {
		return fmt.Errorf("encode DynamoDB item: %w", err)
	}
	_, err = s.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(s.tableName),
		Item:      item,
	})
	if err != nil {
		return fmt.Errorf("write rank snapshot: %w", err)
	}
	return nil
}

func (s *Store) QueryRange(ctx context.Context, start, end time.Time) ([]Snapshot, error) {
	start = start.UTC()
	end = end.UTC()
	if !end.After(start) {
		return nil, fmt.Errorf("end must be after start")
	}

	result := make([]Snapshot, 0)
	for _, month := range monthsBetween(start, end) {
		var cursor map[string]types.AttributeValue
		for {
			output, err := s.client.Query(ctx, &dynamodb.QueryInput{
				TableName:              aws.String(s.tableName),
				KeyConditionExpression: aws.String("pk = :pk AND sk BETWEEN :start AND :end"),
				ExpressionAttributeValues: map[string]types.AttributeValue{
					":pk":    &types.AttributeValueMemberS{Value: partitionKey(month)},
					":start": &types.AttributeValueMemberS{Value: start.Format(sortKeyLayout)},
					":end":   &types.AttributeValueMemberS{Value: end.Add(-time.Second).Format(sortKeyLayout)},
				},
				ExclusiveStartKey: cursor,
				ConsistentRead:    aws.Bool(false),
			})
			if err != nil {
				return nil, fmt.Errorf("query rank snapshots: %w", err)
			}
			for _, raw := range output.Items {
				var item dynamoItem
				if err := attributevalue.UnmarshalMap(raw, &item); err != nil {
					return nil, fmt.Errorf("decode DynamoDB item: %w", err)
				}
				var snapshot Snapshot
				if err := json.Unmarshal([]byte(item.Payload), &snapshot); err != nil {
					return nil, fmt.Errorf("decode rank snapshot payload: %w", err)
				}
				if !snapshot.ObservedHour.Before(start) && snapshot.ObservedHour.Before(end) {
					result = append(result, snapshot)
				}
			}
			cursor = output.LastEvaluatedKey
			if len(cursor) == 0 {
				break
			}
		}
	}
	sort.Slice(result, func(i, j int) bool { return result[i].ObservedHour.Before(result[j].ObservedHour) })
	return result, nil
}

func partitionKey(value time.Time) string {
	return "RANK#" + value.UTC().Format("2006-01")
}

func monthsBetween(start, end time.Time) []time.Time {
	month := time.Date(start.Year(), start.Month(), 1, 0, 0, 0, 0, time.UTC)
	last := time.Date(end.Add(-time.Nanosecond).Year(), end.Add(-time.Nanosecond).Month(), 1, 0, 0, 0, 0, time.UTC)
	months := make([]time.Time, 0, 2)
	for !month.After(last) {
		months = append(months, month)
		month = month.AddDate(0, 1, 0)
	}
	return months
}
