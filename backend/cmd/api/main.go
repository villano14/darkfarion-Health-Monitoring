// Command api runs the CrewHealth backend. On start it applies pending database migrations,
// optionally seeds a demo mission, and then serves the REST API.
//
// Environment:
//
//	DATABASE_URL   PostgreSQL connection string (required)
//	PORT           listen port (default 8080; Railway sets it)
//	JWT_SECRET     signing key for session tokens (required in production)
//	CORS_ORIGINS   comma-separated allowed origins, e.g. https://crewhealth.vercel.app (default *)
//	SEED_DEMO      "true" seeds a demo mission into an empty database; "reset" recreates it
//	SEED_PASSWORD  password of the demo accounts (default demo1234)
//	NASA_API_KEY   api.nasa.gov key for DONKI (default DEMO_KEY)
//	GROQ_API_KEY   key for Orbi, the assistant
package main

import (
	"context"
	"crypto/rand"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"crewhealth/backend/internal/chat"
	"crewhealth/backend/internal/db"
	"crewhealth/backend/internal/health"
	"crewhealth/backend/internal/httpapi"
	"crewhealth/backend/internal/nasa"
	"crewhealth/backend/internal/seed"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	if err := run(); err != nil {
		slog.Error("fatal", "err", err)
		os.Exit(1)
	}
}

func env(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func run() error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		return errors.New("DATABASE_URL is required")
	}
	// 1. Migrations run before anything else; the API does not start on a failed migration.
	if err := db.Migrate(dsn); err != nil {
		return err
	}
	pool, err := db.Open(ctx, dsn)
	if err != nil {
		return err
	}
	defer pool.Close()

	catalog, err := health.LoadCatalog(ctx, pool)
	if err != nil {
		return err
	}

	// 2. Optional demo mission.
	seedMode := strings.ToLower(env("SEED_DEMO", "false"))
	password := env("SEED_PASSWORD", "demo1234")
	demo := seedMode == "true" || seedMode == "reset"
	if demo {
		if err := seed.Run(ctx, pool, catalog, seedMode, password); err != nil {
			return err
		}
	}

	secret := []byte(os.Getenv("JWT_SECRET"))
	if len(secret) < 32 {
		slog.Warn("JWT_SECRET missing or shorter than 32 bytes: using a random key (sessions end on restart)")
		secret = make([]byte, 32)
		_, _ = rand.Read(secret)
	}
	cfg := httpapi.Config{
		JWTSecret:   secret,
		CORSOrigins: strings.Split(env("CORS_ORIGINS", "*"), ","),
		Demo:        demo,
	}
	for i := range cfg.CORSOrigins {
		cfg.CORSOrigins[i] = strings.TrimRight(strings.TrimSpace(cfg.CORSOrigins[i]), "/")
	}
	if demo {
		cfg.DemoAccounts = seed.Accounts(password)
	}

	weather := nasa.NewWeather(pool, os.Getenv("NASA_API_KEY"))
	go weather.Run(ctx)

	srv := &http.Server{
		Addr:              ":" + env("PORT", "8080"),
		Handler:           httpapi.New(pool, catalog, cfg, weather, chat.New(os.Getenv("GROQ_API_KEY"))).Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdown)
	}()
	slog.Info("CrewHealth API listening", "addr", srv.Addr, "demo", demo)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}
