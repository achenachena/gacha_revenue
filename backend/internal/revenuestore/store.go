package revenuestore

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"

	"gacha-revenue/backend/internal/revenue"
)

const partitionKey = "REVENUE"

type dynamoItem struct {
	PK      string `dynamodbav:"pk"`
	SK      string `dynamodbav:"sk"`
	Payload string `dynamodbav:"payload"`
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

func (s *Store) Put(ctx context.Context, history revenue.GameHistory) error {
	if err := revenue.Validate(history); err != nil {
		return err
	}
	payload, err := json.Marshal(history)
	if err != nil {
		return fmt.Errorf("encode revenue history: %w", err)
	}
	item, err := attributevalue.MarshalMap(dynamoItem{PK: partitionKey, SK: history.GameID, Payload: string(payload)})
	if err != nil {
		return fmt.Errorf("encode revenue DynamoDB item: %w", err)
	}
	_, err = s.client.PutItem(ctx, &dynamodb.PutItemInput{TableName: aws.String(s.tableName), Item: item})
	if err != nil {
		return fmt.Errorf("write revenue history: %w", err)
	}
	return nil
}

func (s *Store) List(ctx context.Context) ([]revenue.GameHistory, error) {
	result := make([]revenue.GameHistory, 0, len(revenue.Definitions))
	var cursor map[string]types.AttributeValue
	for {
		output, err := s.client.Query(ctx, &dynamodb.QueryInput{
			TableName: aws.String(s.tableName), KeyConditionExpression: aws.String("pk = :pk"),
			ExpressionAttributeValues: map[string]types.AttributeValue{":pk": &types.AttributeValueMemberS{Value: partitionKey}},
			ExclusiveStartKey:         cursor, ConsistentRead: aws.Bool(false),
		})
		if err != nil {
			return nil, fmt.Errorf("query revenue histories: %w", err)
		}
		for _, raw := range output.Items {
			var item dynamoItem
			if err := attributevalue.UnmarshalMap(raw, &item); err != nil {
				return nil, fmt.Errorf("decode revenue DynamoDB item: %w", err)
			}
			var history revenue.GameHistory
			if err := json.Unmarshal([]byte(item.Payload), &history); err != nil {
				return nil, fmt.Errorf("decode revenue payload: %w", err)
			}
			if err := revenue.Validate(history); err != nil {
				return nil, fmt.Errorf("invalid stored revenue history: %w", err)
			}
			result = append(result, history)
		}
		cursor = output.LastEvaluatedKey
		if len(cursor) == 0 {
			break
		}
	}
	sort.Slice(result, func(i, j int) bool { return result[i].GameID < result[j].GameID })
	return result, nil
}
