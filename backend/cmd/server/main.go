// Command server boots the Minigames Storefront API: it loads config, opens the
// store, seeds defaults, and serves HTTP. Swapping the storage backend is a
// one-line change here (sqlite.Open -> dynamo.Open) because everything else
// depends only on the storage.Store interface.
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/sanditzz/minigames-storefront/backend/internal/app"
	"github.com/sanditzz/minigames-storefront/backend/internal/config"
	"github.com/sanditzz/minigames-storefront/backend/internal/game"
	"github.com/sanditzz/minigames-storefront/backend/internal/httpapi"
	"github.com/sanditzz/minigames-storefront/backend/internal/storage/sqlite"
)

func main() {
	if err := run(); err != nil {
		log.Fatalf("fatal: %v", err)
	}
}

func run() error {
	cfg := config.Load()

	store, err := sqlite.Open(cfg.DBPath)
	if err != nil {
		return err
	}
	defer store.Close()

	ctx := context.Background()
	if err := store.Migrate(ctx); err != nil {
		return err
	}

	svc := app.New(store, game.DefaultRegistry(), time.Now)
	if err := svc.Seed(ctx); err != nil {
		return err
	}

	server := httpapi.NewServer(svc, strings.Split(cfg.CORSOrigins, ","), cfg.AdminToken)
	httpServer := &http.Server{
		Addr:              cfg.Addr,
		Handler:           server.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	// Graceful shutdown on SIGINT/SIGTERM.
	go func() {
		sig := make(chan os.Signal, 1)
		signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
		<-sig
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = httpServer.Shutdown(shutdownCtx)
	}()

	log.Printf("minigames API listening on %s (db=%s)", cfg.Addr, cfg.DBPath)
	if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}
