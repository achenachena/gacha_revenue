package security

import (
	"crypto/subtle"
	"encoding/json"
	"net/http"
)

const proxyTokenHeader = "X-Backend-Token"
const MinProxyTokenBytes = 32

func ValidProxyToken(token string) bool {
	return len(token) >= MinProxyTokenBytes && len(token) <= 256
}

// RequireProxyToken keeps the Lambda Function URL unreachable to arbitrary
// callers while allowing /healthz for infrastructure health checks. The public
// browser talks to the Vercel same-origin proxy, which adds this server-only
// token.
func RequireProxyToken(next http.Handler, expected string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/healthz" {
			next.ServeHTTP(w, r)
			return
		}
		provided := r.Header.Get(proxyTokenHeader)
		if !ValidProxyToken(expected) || len(provided) != len(expected) || subtle.ConstantTimeCompare([]byte(provided), []byte(expected)) != 1 {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.Header().Set("Cache-Control", "no-store")
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "unauthorized"})
			return
		}
		next.ServeHTTP(w, r)
	})
}
