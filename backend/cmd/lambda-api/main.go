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

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"

	"gacha-revenue/backend/internal/config"
	"gacha-revenue/backend/internal/httpapi"
	"gacha-revenue/backend/internal/rankstore"
	"gacha-revenue/backend/internal/serverlessapi"
)

type lambdaHandler struct {
	http http.Handler
}

func main() {
	ctx := context.Background()
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	tableName := os.Getenv("DYNAMODB_TABLE")
	if tableName == "" {
		logger.Error("DYNAMODB_TABLE is required")
		os.Exit(1)
	}
	awsCfg, err := awsconfig.LoadDefaultConfig(ctx)
	if err != nil {
		logger.Error("load AWS config", "error", err)
		os.Exit(1)
	}
	store := rankstore.New(dynamodb.NewFromConfig(awsCfg), tableName)
	fallback := httpapi.New(config.Config{}, logger)
	lambda.Start((&lambdaHandler{http: serverlessapi.New(store, fallback, logger)}).Invoke)
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
		if len(values) > 0 {
			headers[key] = values[0]
		}
	}
	return events.LambdaFunctionURLResponse{StatusCode: response.StatusCode, Headers: headers, Body: string(responseBody)}, nil
}
