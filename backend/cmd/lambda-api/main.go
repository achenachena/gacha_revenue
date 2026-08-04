package main

import (
	"context"
	"encoding/base64"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"

	"gacha-revenue/backend/internal/bannercalendar"
	"gacha-revenue/backend/internal/httpapi"
	"gacha-revenue/backend/internal/rankfeed"
	"gacha-revenue/backend/internal/rankstore"
	"gacha-revenue/backend/internal/security"
	"gacha-revenue/backend/internal/serverlessapi"
)

type lambdaHandler struct {
	http http.Handler
}

func main() {
	ctx := context.Background()
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	tableName := os.Getenv("DYNAMODB_TABLE")
	proxyToken := os.Getenv("PROXY_TOKEN")
	if tableName == "" || !security.ValidProxyToken(proxyToken) {
		logger.Error("DYNAMODB_TABLE and a 32-256 byte PROXY_TOKEN are required")
		os.Exit(1)
	}
	collectionStartedAt, err := time.Parse(time.RFC3339, os.Getenv("RANK_COLLECTION_STARTED_AT"))
	if err != nil {
		logger.Error("RANK_COLLECTION_STARTED_AT must be RFC3339", "error", err)
		os.Exit(1)
	}
	providerHTTPClient := &http.Client{
		Timeout:       15 * time.Second,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse },
	}
	calendarClient, err := bannercalendar.New(
		providerHTTPClient,
		os.Getenv("CALENDAR_FEED_URL"),
		os.Getenv("CALENDAR_FEED_TOKEN"),
	)
	if err != nil {
		logger.Error("configure calendar feed", "error", err)
		os.Exit(1)
	}
	historyClient, err := rankfeed.New(providerHTTPClient, os.Getenv("RANK_HISTORY_FEED_URL"), os.Getenv("RANK_HISTORY_FEED_TOKEN"))
	if err != nil {
		logger.Error("configure rank history feed", "error", err)
		os.Exit(1)
	}
	calendar := optionalCalendar(calendarClient)
	history := optionalHistory(historyClient)
	awsCfg, err := awsconfig.LoadDefaultConfig(ctx)
	if err != nil {
		logger.Error("load AWS config", "error", err)
		os.Exit(1)
	}
	store := rankstore.New(dynamodb.NewFromConfig(awsCfg), tableName)
	fallback := httpapi.New(logger, calendar)
	api := serverlessapi.New(store, fallback, logger, serverlessapi.Options{CollectionStartedAt: collectionStartedAt, History: history})
	lambda.Start((&lambdaHandler{http: security.RequireProxyToken(api, proxyToken)}).Invoke)
}

func optionalCalendar(client *bannercalendar.Client) httpapi.Calendar {
	if client == nil {
		return nil
	}
	return client
}

func optionalHistory(client *rankfeed.Client) serverlessapi.HistoryReader {
	if client == nil {
		return nil
	}
	return client
}

func (h *lambdaHandler) Invoke(ctx context.Context, event events.LambdaFunctionURLRequest) (events.LambdaFunctionURLResponse, error) {
	body := []byte(event.Body)
	if event.IsBase64Encoded {
		decoded, err := base64.StdEncoding.DecodeString(event.Body)
		if err != nil {
			return events.LambdaFunctionURLResponse{StatusCode: http.StatusBadRequest, Body: `{"error":"invalid request body"}`}, nil
		}
		body = decoded
	}
	path := event.RawPath
	if path == "" {
		path = "/"
	}
	requestURL := &url.URL{Scheme: "https", Host: "lambda.invalid", Path: path, RawQuery: event.RawQueryString}
	request, err := http.NewRequestWithContext(ctx, event.RequestContext.HTTP.Method, requestURL.String(), strings.NewReader(string(body)))
	if err != nil {
		return events.LambdaFunctionURLResponse{}, err
	}
	for key, value := range event.Headers {
		request.Header.Set(key, value)
	}
	recorder := httptest.NewRecorder()
	h.http.ServeHTTP(recorder, request)
	response := recorder.Result()
	defer response.Body.Close()
	responseBody, err := io.ReadAll(response.Body)
	if err != nil {
		return events.LambdaFunctionURLResponse{}, err
	}
	headers := make(map[string]string, len(response.Header))
	for key, values := range response.Header {
		// Function URL CORS is configured at the AWS edge. Forwarding the
		// application's CORS headers as well produces a duplicated, invalid
		// Access-Control-Allow-Origin value in browsers.
		if strings.HasPrefix(strings.ToLower(key), "access-control-") {
			continue
		}
		if len(values) > 0 {
			headers[key] = values[0]
		}
	}
	return events.LambdaFunctionURLResponse{StatusCode: response.StatusCode, Headers: headers, Body: string(responseBody)}, nil
}
