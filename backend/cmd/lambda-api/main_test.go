package main

import (
	"context"
	"net/http"
	"testing"

	"github.com/aws/aws-lambda-go/events"
)

func TestInvokeLeavesCORSHeadersToFunctionURL(t *testing.T) {
	handler := &lambdaHandler{http: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("X-Test", "present")
		w.WriteHeader(http.StatusOK)
	})}
	response, err := handler.Invoke(context.Background(), events.LambdaFunctionURLRequest{
		RawPath: "/healthz",
		RequestContext: events.LambdaFunctionURLRequestContext{
			HTTP: events.LambdaFunctionURLRequestContextHTTPDescription{Method: http.MethodGet},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, exists := response.Headers["Access-Control-Allow-Origin"]; exists {
		t.Fatalf("application CORS header must not be forwarded: %+v", response.Headers)
	}
	if response.Headers["X-Test"] != "present" {
		t.Fatalf("non-CORS response headers must be preserved: %+v", response.Headers)
	}
}
