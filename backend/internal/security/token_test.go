package security

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRequireProxyToken(t *testing.T) {
	token := "0123456789abcdef0123456789abcdef"
	handler := RequireProxyToken(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) }), token)

	unauthorized := httptest.NewRecorder()
	handler.ServeHTTP(unauthorized, httptest.NewRequest(http.MethodGet, "/v1/games", nil))
	if unauthorized.Code != http.StatusUnauthorized || unauthorized.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("unexpected unauthorized response: %d %+v", unauthorized.Code, unauthorized.Header())
	}

	authorizedRequest := httptest.NewRequest(http.MethodGet, "/v1/games", nil)
	authorizedRequest.Header.Set(proxyTokenHeader, token)
	authorized := httptest.NewRecorder()
	handler.ServeHTTP(authorized, authorizedRequest)
	if authorized.Code != http.StatusNoContent {
		t.Fatalf("expected authorized request, got %d", authorized.Code)
	}

	health := httptest.NewRecorder()
	handler.ServeHTTP(health, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	if health.Code != http.StatusNoContent {
		t.Fatalf("health check should not require the proxy token, got %d", health.Code)
	}
}

func TestValidProxyTokenRejectsWeakValues(t *testing.T) {
	if ValidProxyToken("short") || !ValidProxyToken("0123456789abcdef0123456789abcdef") {
		t.Fatal("unexpected proxy token validation result")
	}
}
