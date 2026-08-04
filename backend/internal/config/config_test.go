package config

import (
	"net/url"
	"testing"
)

func TestDatabaseURLSafelyEncodesManagedPassword(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	t.Setenv("PGHOST", "db.example.internal")
	t.Setenv("PGPORT", "5432")
	t.Setenv("PGUSER", "gacha_admin")
	t.Setenv("PGPASSWORD", `p@ss:/?#word`)
	t.Setenv("PGDATABASE", "gacha")
	t.Setenv("PGSSLMODE", "require")

	parsed, err := url.Parse(databaseURL())
	if err != nil {
		t.Fatal(err)
	}
	password, present := parsed.User.Password()
	if !present || password != `p@ss:/?#word` || parsed.Host != "db.example.internal:5432" || parsed.Query().Get("sslmode") != "require" {
		t.Fatalf("database URL did not round-trip safely: %s", parsed.Redacted())
	}
}
