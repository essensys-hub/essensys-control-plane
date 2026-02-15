package api

import (
	"io/fs"
	"net/http"

	"github.com/essensys-hub/essensys-control-plane/internal/docker"
	redisclient "github.com/essensys-hub/essensys-control-plane/internal/redis"
	"github.com/essensys-hub/essensys-control-plane/internal/store"
)

func NewRouter(
	dockerClient *docker.Client,
	redisClient *redisclient.Client,
	sqliteStore *store.Store,
	token string,
	staticFS fs.FS,
) http.Handler {
	mux := http.NewServeMux()

	// Handlers
	services := NewServicesHandler(dockerClient, sqliteStore)
	redis := NewRedisHandler(redisClient, sqliteStore)
	logs := NewLogsHandler(dockerClient)
	system := NewSystemHandler()

	// Health check (no auth)
	mux.HandleFunc("GET /health", system.Health)

	// --- Services API ---
	mux.HandleFunc("GET /api/services", services.List)
	mux.HandleFunc("GET /api/services/{name}", services.Get)
	mux.HandleFunc("POST /api/services/{name}/restart", services.Restart)
	mux.HandleFunc("POST /api/services/{name}/update", services.Update)
	mux.HandleFunc("POST /api/services/{name}/rollback", services.Rollback)

	// --- Versions API ---
	mux.HandleFunc("GET /api/versions", services.Versions)
	mux.HandleFunc("POST /api/update/check", services.CheckUpdates)
	mux.HandleFunc("POST /api/update/apply", services.CheckUpdates) // TODO: apply all
	mux.HandleFunc("GET /api/updates/history", services.UpdateHistory)

	// --- Logs API ---
	mux.HandleFunc("GET /api/logs/all", logs.GetAllLogs)
	mux.HandleFunc("GET /api/logs/all/stream", logs.StreamAllLogs)
	mux.HandleFunc("GET /api/logs/{service}", logs.GetLogs)
	mux.HandleFunc("GET /api/logs/{service}/stream", logs.StreamLogs)

	// --- System API ---
	mux.HandleFunc("GET /api/system", system.GetSystem)
	mux.HandleFunc("GET /api/system/health", system.Health)

	// --- Redis Exchange API ---
	mux.HandleFunc("GET /api/redis/exchange/{clientID}/search", redis.SearchExchange)
	mux.HandleFunc("GET /api/redis/exchange/{clientID}/stream", redis.StreamExchange)
	mux.HandleFunc("GET /api/redis/exchange/{clientID}/{index}", redis.GetExchangeValue)
	mux.HandleFunc("PUT /api/redis/exchange/{clientID}/{index}", redis.SetExchangeValue)
	mux.HandleFunc("GET /api/redis/exchange/{clientID}", redis.GetExchangeTable)

	// --- Redis Clients API ---
	mux.HandleFunc("GET /api/redis/clients/{clientID}/authinfo", redis.GetClientAuthInfo)
	mux.HandleFunc("GET /api/redis/clients/{clientID}", redis.GetClient)
	mux.HandleFunc("GET /api/redis/clients", redis.ListClients)

	// --- Redis Actions API ---
	mux.HandleFunc("GET /api/redis/actions", redis.GetActions)
	mux.HandleFunc("POST /api/redis/actions", redis.PushAction)
	mux.HandleFunc("DELETE /api/redis/actions/{guid}", redis.RemoveAction)
	mux.HandleFunc("DELETE /api/redis/actions", redis.PurgeActions)

	// --- Redis Monitor API ---
	mux.HandleFunc("GET /api/redis/info", redis.GetInfo)
	mux.HandleFunc("GET /api/redis/keys", redis.ListKeys)
	mux.HandleFunc("POST /api/redis/backup", redis.Backup)
	mux.HandleFunc("POST /api/redis/restore", redis.Restore)

	// --- Audit API ---
	mux.HandleFunc("GET /api/audit", redis.GetAuditLog)

	// --- Static files (React UI) ---
	if staticFS != nil {
		fileServer := http.FileServerFS(staticFS)
		mux.Handle("/", spaHandler(fileServer, staticFS))
	}

	// Middleware chain: Recovery → CORS → Logger → Auth → Routes
	var handler http.Handler = mux
	handler = BearerAuth(token)(handler)
	handler = RequestLogger(handler)
	handler = CORS(handler)
	handler = Recovery(handler)

	return handler
}

// spaHandler serves the React SPA - returns index.html for non-file routes
func spaHandler(fileServer http.Handler, staticFS fs.FS) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Try to serve the file directly
		path := r.URL.Path
		if path == "/" {
			path = "index.html"
		} else if path[0] == '/' {
			path = path[1:]
		}

		// Check if file exists in the static FS
		if _, err := fs.Stat(staticFS, path); err == nil {
			fileServer.ServeHTTP(w, r)
			return
		}

		// For SPA routes, serve index.html
		r.URL.Path = "/"
		fileServer.ServeHTTP(w, r)
	})
}
