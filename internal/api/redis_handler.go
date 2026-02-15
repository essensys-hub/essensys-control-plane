package api

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	redisclient "github.com/essensys-hub/essensys-control-plane/internal/redis"
	"github.com/essensys-hub/essensys-control-plane/internal/store"
)

type RedisHandler struct {
	redis *redisclient.Client
	store *store.Store
}

func NewRedisHandler(r *redisclient.Client, s *store.Store) *RedisHandler {
	return &RedisHandler{redis: r, store: s}
}

// GET /api/redis/exchange/{clientID}
func (h *RedisHandler) GetExchangeTable(w http.ResponseWriter, r *http.Request) {
	clientID := r.PathValue("clientID")
	if clientID == "" {
		clientID = "default"
	}

	entries, err := h.redis.GetExchangeTable(clientID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, entries)
}

// GET /api/redis/exchange/{clientID}/{index}
func (h *RedisHandler) GetExchangeValue(w http.ResponseWriter, r *http.Request) {
	clientID := r.PathValue("clientID")
	if clientID == "" {
		clientID = "default"
	}

	index, err := strconv.Atoi(r.PathValue("index"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid index")
		return
	}

	value, found, err := h.redis.GetExchangeValue(clientID, index)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if !found {
		writeError(w, http.StatusNotFound, "index not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"index": index,
		"value": value,
	})
}

// PUT /api/redis/exchange/{clientID}/{index}
func (h *RedisHandler) SetExchangeValue(w http.ResponseWriter, r *http.Request) {
	clientID := r.PathValue("clientID")
	if clientID == "" {
		clientID = "default"
	}

	index, err := strconv.Atoi(r.PathValue("index"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid index")
		return
	}

	var body struct {
		Value string `json:"value"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	oldValue, err := h.redis.SetExchangeValue(clientID, index, body.Value)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Audit log
	key := "exchange:" + clientID + ":" + strconv.Itoa(index)
	h.store.LogAudit("set_exchange", key, oldValue, body.Value, "api")

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"index":     index,
		"old_value": oldValue,
		"new_value": body.Value,
	})
}

// GET /api/redis/exchange/{clientID}/search?q=...
func (h *RedisHandler) SearchExchange(w http.ResponseWriter, r *http.Request) {
	clientID := r.PathValue("clientID")
	if clientID == "" {
		clientID = "default"
	}

	query := r.URL.Query().Get("q")
	if query == "" {
		writeError(w, http.StatusBadRequest, "query parameter 'q' is required")
		return
	}

	entries, err := h.redis.SearchExchange(clientID, query)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, entries)
}

// GET /api/redis/exchange/{clientID}/stream (WebSocket)
func (h *RedisHandler) StreamExchange(w http.ResponseWriter, r *http.Request) {
	clientID := r.PathValue("clientID")
	if clientID == "" {
		clientID = "default"
	}

	conn, err := upgradeWebSocket(w, r)
	if err != nil {
		return
	}
	defer conn.Close()

	log.Printf("[WS] Exchange stream started for client %s", clientID)

	// Poll for changes every 500ms
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	var lastData []byte

	for {
		select {
		case <-ticker.C:
			entries, err := h.redis.GetExchangeTable(clientID)
			if err != nil {
				continue
			}

			data, _ := json.Marshal(entries)
			if string(data) != string(lastData) {
				if err := conn.WriteJSON(entries); err != nil {
					log.Printf("[WS] Write error: %v", err)
					return
				}
				lastData = data
			}

		case <-r.Context().Done():
			return
		}
	}
}

// GET /api/redis/clients
func (h *RedisHandler) ListClients(w http.ResponseWriter, r *http.Request) {
	clients, err := h.redis.ListClients()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, clients)
}

// GET /api/redis/clients/{clientID}
func (h *RedisHandler) GetClient(w http.ResponseWriter, r *http.Request) {
	clientID := r.PathValue("clientID")
	if clientID == "" {
		writeError(w, http.StatusBadRequest, "clientID required")
		return
	}

	info, err := h.redis.GetClientInfo(clientID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, info)
}

// GET /api/redis/clients/{clientID}/authinfo
func (h *RedisHandler) GetClientAuthInfo(w http.ResponseWriter, r *http.Request) {
	clientID := r.PathValue("clientID")
	if clientID == "" {
		writeError(w, http.StatusBadRequest, "clientID required")
		return
	}

	info, err := h.redis.GetClientInfo(clientID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"ip":           info.IP,
		"auth":         info.Auth,
		"version":      info.Version,
		"last_updated": info.LastUpdated,
	})
}

// GET /api/redis/actions
func (h *RedisHandler) GetActions(w http.ResponseWriter, r *http.Request) {
	actions, err := h.redis.GetActions()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, actions)
}

// POST /api/redis/actions
func (h *RedisHandler) PushAction(w http.ResponseWriter, r *http.Request) {
	var action redisclient.Action
	if err := json.NewDecoder(r.Body).Decode(&action); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	if err := h.redis.PushAction(action); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.store.LogAudit("push_action", "actions:"+action.GUID, "", action.GUID, "api")
	writeOK(w, "Action pushed")
}

// DELETE /api/redis/actions/{guid}
func (h *RedisHandler) RemoveAction(w http.ResponseWriter, r *http.Request) {
	guid := r.PathValue("guid")
	if guid == "" {
		writeError(w, http.StatusBadRequest, "GUID required")
		return
	}

	if err := h.redis.RemoveAction(guid); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	h.store.LogAudit("remove_action", "actions:"+guid, guid, "", "api")
	writeOK(w, "Action removed")
}

// DELETE /api/redis/actions
func (h *RedisHandler) PurgeActions(w http.ResponseWriter, r *http.Request) {
	count, err := h.redis.PurgeActions()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.store.LogAudit("purge_actions", "actions:*", strconv.FormatInt(count, 10), "0", "api")
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":  "ok",
		"purged":  count,
	})
}

// GET /api/redis/info
func (h *RedisHandler) GetInfo(w http.ResponseWriter, r *http.Request) {
	info, err := h.redis.GetRedisInfo()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, info)
}

// GET /api/redis/keys
func (h *RedisHandler) ListKeys(w http.ResponseWriter, r *http.Request) {
	keys, err := h.redis.ListKeys()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, keys)
}

// POST /api/redis/backup
func (h *RedisHandler) Backup(w http.ResponseWriter, r *http.Request) {
	data, err := h.redis.BackupAll()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.store.LogAudit("backup", "redis:*", "", strconv.Itoa(len(data))+" keys", "api")

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", "attachment; filename=essensys-redis-backup.json")
	json.NewEncoder(w).Encode(data)
}

// POST /api/redis/restore
func (h *RedisHandler) Restore(w http.ResponseWriter, r *http.Request) {
	var data map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}

	if err := h.redis.RestoreAll(data); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.store.LogAudit("restore", "redis:*", "", strconv.Itoa(len(data))+" keys", "api")
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":   "ok",
		"restored": len(data),
	})
}

// GET /api/audit
func (h *RedisHandler) GetAuditLog(w http.ResponseWriter, r *http.Request) {
	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil {
			limit = v
		}
	}

	key := r.URL.Query().Get("key")
	entries, err := h.store.GetAuditLog(limit, key)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, entries)
}
