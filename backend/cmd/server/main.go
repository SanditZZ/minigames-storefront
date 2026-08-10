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
	"github.com/sanditzz/minigames-storefront/backend/internal/blob"
	"github.com/sanditzz/minigames-storefront/backend/internal/blob/localfs"
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

	// Object storage. Swapping to S3 is this one line, for the same reason
	// swapping the database is: everything downstream depends on the interface.
	// A failure here is not fatal — the API still runs with image URLs typed by
	// hand, which is what it did before uploads existed.
	//
	// Declared as the INTERFACE, not as *localfs.Store. Assigning a nil
	// *localfs.Store to a blob.Store variable would produce a non-nil interface
	// holding a nil pointer, and every `if s.blobs == nil` guard downstream
	// would quietly stop working.
	var blobs blob.Store
	if fs, err := localfs.Open(cfg.UploadDir, cfg.PublicURL); err != nil {
		log.Printf("WARNING: uploads disabled (%v)", err)
	} else {
		blobs = fs
		log.Printf("uploads: %s served at %s%s", cfg.UploadDir, cfg.PublicURL, blob.URLPrefix)
	}

	server := httpapi.NewServer(svc, strings.Split(cfg.CORSOrigins, ","), cfg.AdminToken, blobs, cfg.RateLimitPerMinute, cfg.RateLimitBurst)
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
