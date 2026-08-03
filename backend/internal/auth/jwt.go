package auth

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"
)

type contextKey string

const claimsKey contextKey = "claims"

type Claims struct {
	Subject  string   `json:"sub"`
	Issuer   string   `json:"iss"`
	Audience string   `json:"aud"`
	ClientID string   `json:"client_id"`
	TokenUse string   `json:"token_use"`
	Expires  int64    `json:"exp"`
	Groups   []string `json:"cognito:groups"`
	Role     string   `json:"-"`
}

type Verifier struct {
	issuer   string
	clientID string
	client   *http.Client
	mu       sync.RWMutex
	keys     map[string]*rsa.PublicKey
	fetched  time.Time
}

func NewVerifier(issuer, clientID string) *Verifier {
	return &Verifier{
		issuer:   strings.TrimRight(issuer, "/"),
		clientID: clientID,
		client:   &http.Client{Timeout: 5 * time.Second},
		keys:     make(map[string]*rsa.PublicKey),
	}
}

func (v *Verifier) Verify(ctx context.Context, token string) (Claims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return Claims{}, errors.New("malformed JWT")
	}

	var header struct {
		Algorithm string `json:"alg"`
		KeyID     string `json:"kid"`
	}
	if err := decodeJSON(parts[0], &header); err != nil || header.Algorithm != "RS256" || header.KeyID == "" {
		return Claims{}, errors.New("unsupported JWT header")
	}

	key, err := v.key(ctx, header.KeyID)
	if err != nil {
		return Claims{}, err
	}
	signature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return Claims{}, errors.New("invalid JWT signature encoding")
	}
	digest := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
	if err := rsa.VerifyPKCS1v15(key, crypto.SHA256, digest[:], signature); err != nil {
		return Claims{}, errors.New("invalid JWT signature")
	}

	var claims Claims
	if err := decodeJSON(parts[1], &claims); err != nil {
		return Claims{}, errors.New("invalid JWT claims")
	}
	if claims.Issuer != v.issuer || claims.Expires <= time.Now().Unix() {
		return Claims{}, errors.New("expired token or issuer mismatch")
	}
	if claims.TokenUse != "access" || claims.ClientID != v.clientID {
		return Claims{}, errors.New("token use or client mismatch")
	}
	claims.Role = roleFromGroups(claims.Groups)
	return claims, nil
}

func (v *Verifier) key(ctx context.Context, keyID string) (*rsa.PublicKey, error) {
	v.mu.RLock()
	key, ok := v.keys[keyID]
	fresh := time.Since(v.fetched) < time.Hour
	v.mu.RUnlock()
	if ok && fresh {
		return key, nil
	}
	if err := v.refresh(ctx); err != nil {
		return nil, err
	}
	v.mu.RLock()
	defer v.mu.RUnlock()
	key, ok = v.keys[keyID]
	if !ok {
		return nil, errors.New("JWT signing key not found")
	}
	return key, nil
}

func (v *Verifier) refresh(ctx context.Context) error {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, v.issuer+"/.well-known/jwks.json", nil)
	if err != nil {
		return err
	}
	response, err := v.client.Do(request)
	if err != nil {
		return fmt.Errorf("fetch Cognito JWKS: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("fetch Cognito JWKS: status %d", response.StatusCode)
	}
	var document struct {
		Keys []struct {
			KeyID string `json:"kid"`
			N     string `json:"n"`
			E     string `json:"e"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(response.Body).Decode(&document); err != nil {
		return err
	}
	keys := make(map[string]*rsa.PublicKey, len(document.Keys))
	for _, jwk := range document.Keys {
		nBytes, nErr := base64.RawURLEncoding.DecodeString(jwk.N)
		eBytes, eErr := base64.RawURLEncoding.DecodeString(jwk.E)
		if nErr != nil || eErr != nil || len(eBytes) == 0 {
			continue
		}
		exponent := 0
		for _, b := range eBytes {
			exponent = exponent<<8 + int(b)
		}
		keys[jwk.KeyID] = &rsa.PublicKey{N: new(big.Int).SetBytes(nBytes), E: exponent}
	}
	v.mu.Lock()
	v.keys = keys
	v.fetched = time.Now()
	v.mu.Unlock()
	return nil
}

func decodeJSON(segment string, destination any) error {
	payload, err := base64.RawURLEncoding.DecodeString(segment)
	if err != nil {
		return err
	}
	return json.Unmarshal(payload, destination)
}

func roleFromGroups(groups []string) string {
	for _, group := range groups {
		if group == "admin" {
			return "admin"
		}
	}
	for _, group := range groups {
		if group == "editor" {
			return "editor"
		}
	}
	return "viewer"
}

func WithClaims(ctx context.Context, claims Claims) context.Context {
	return context.WithValue(ctx, claimsKey, claims)
}

func FromContext(ctx context.Context) Claims {
	claims, _ := ctx.Value(claimsKey).(Claims)
	return claims
}
