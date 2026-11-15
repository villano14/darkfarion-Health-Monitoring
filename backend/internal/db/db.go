// Package db opens the PostgreSQL pool and applies migrations at startup.
package db

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/pgx/v5" // registers pgx5://
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/jackc/pgx/v5/pgxpool"

	"crewhealth/backend/migrations"
)

// Migrate applies every pending migration. The driver holds a PostgreSQL advisory lock
// while it runs, so several API instances starting together never migrate twice.
func Migrate(databaseURL string) error {
	src, err := iofs.New(migrations.FS, ".")
	if err != nil {
		return fmt.Errorf("read migrations: %w", err)
	}
	m, err := migrate.NewWithSourceInstance("iofs", src, migrateURL(databaseURL))
	if err != nil {
		return fmt.Errorf("connect for migrations: %w", err)
	}
	defer m.Close()
	before, _, _ := m.Version()
	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("apply migrations: %w", err)
	}
	after, dirty, _ := m.Version()
	slog.Info("migrations ready", "from", before, "to", after, "dirty", dirty)
	return nil
}

// migrateURL turns postgres:// (what Railway and most hosts give) into the pgx5:// scheme the driver expects.
func migrateURL(u string) string {
	for _, p := range []string{"postgresql://", "postgres://"} {
		if strings.HasPrefix(u, p) {
			return "pgx5://" + strings.TrimPrefix(u, p)
		}
	}
	return u
}

// Open connects the pool, retrying while the database comes up (common on first deploys).
func Open(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	var lastErr error
	for attempt := 1; attempt <= 10; attempt++ {
		pool, err := pgxpool.New(ctx, databaseURL)
		if err == nil {
			if err = pool.Ping(ctx); err == nil {
				return pool, nil
			}
			pool.Close()
		}
		lastErr = err
		slog.Warn("database not ready, retrying", "attempt", attempt, "err", err)
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(time.Duration(attempt) * time.Second):
		}
	}
	return nil, fmt.Errorf("connect to database: %w", lastErr)
}
