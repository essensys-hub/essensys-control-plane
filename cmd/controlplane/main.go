package main

import (
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/essensys-hub/essensys-control-plane/internal/api"
	"github.com/essensys-hub/essensys-control-plane/internal/config"
	"github.com/essensys-hub/essensys-control-plane/internal/docker"
	"github.com/essensys-hub/essensys-control-plane/internal/metrics"
	redisclient "github.com/essensys-hub/essensys-control-plane/internal/redis"
	"github.com/essensys-hub/essensys-control-plane/internal/store"
	uidist "github.com/essensys-hub/essensys-control-plane/ui"
)

// Build info (injected via ldflags)
var (
	version   = "dev"
	commit    = "unknown"
	buildTime = "unknown"
)

func main() {
	configPath := flag.String("config", "config.yaml", "Path to config file")
	flag.Parse()

	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Printf("Essensys Control Plane %s (commit=%s, built=%s)", version, commit, buildTime)

	// Load config
	cfg := config.Load(*configPath)

	// Set build info for health endpoint
	api.Version = version
	api.Commit = commit
	api.BuildTime = buildTime

	// Initialize Prometheus metrics
	metrics.Init(version, commit)

	// Initialize SQLite store
	// Ensure directory exists
	if err := os.MkdirAll(dirOf(cfg.SQLite.Path), 0755); err != nil {
		log.Printf("[MAIN] Warning: cannot create SQLite dir: %v", err)
	}
	sqliteStore, err := store.New(cfg.SQLite.Path)
	if err != nil {
		log.Fatalf("[MAIN] Failed to initialize SQLite: %v", err)
	}
	defer sqliteStore.Close()

	// Initialize Redis client
	redisClient, err := redisclient.New(cfg.Redis.Addr, cfg.Redis.Password, cfg.Redis.DB)
	if err != nil {
		log.Fatalf("[MAIN] Failed to connect to Redis: %v", err)
	}
	defer redisClient.Close()

	// Initialize Docker client
	dockerClient, err := docker.New(cfg.Docker.SocketPath, cfg.Registry.Org)
	if err != nil {
		log.Printf("[MAIN] Warning: Docker client init failed: %v (some features disabled)", err)
	}
	if dockerClient != nil {
		defer dockerClient.Close()
	}

	// Prepare static UI files
	var staticFS fs.FS
	uiDistFS, err := fs.Sub(uidist.DistFS, "dist")
	if err != nil {
		log.Printf("[MAIN] Warning: embedded UI not found, serving API only")
	} else {
		staticFS = uiDistFS
	}

	// Build router
	router := api.NewRouter(dockerClient, redisClient, sqliteStore, cfg.Server.Token, staticFS)

	// Mount Prometheus metrics endpoint
	mux := http.NewServeMux()
	mux.Handle("/metrics", metrics.Handler())
	mux.Handle("/", router)

	// Start server
	addr := fmt.Sprintf(":%d", cfg.Server.Port)
	server := &http.Server{
		Addr:    addr,
		Handler: mux,
	}

	// Graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		log.Println("[MAIN] Shutting down...")
		server.Close()
	}()

	log.Printf("[MAIN] Control Plane listening on %s", addr)
	if err := server.ListenAndServe(); err != http.ErrServerClosed {
		log.Fatalf("[MAIN] Server error: %v", err)
	}
}

func dirOf(path string) string {
	for i := len(path) - 1; i >= 0; i-- {
		if path[i] == '/' {
			return path[:i]
		}
	}
	return "."
}
