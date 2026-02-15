package api

import (
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/essensys-hub/essensys-control-plane/internal/docker"
)

type LogsHandler struct {
	docker *docker.Client
}

func NewLogsHandler(d *docker.Client) *LogsHandler {
	return &LogsHandler{docker: d}
}

// GET /api/logs/{service}
func (h *LogsHandler) GetLogs(w http.ResponseWriter, r *http.Request) {
	service := r.PathValue("service")
	if service == "" {
		writeError(w, http.StatusBadRequest, "service name required")
		return
	}

	lines := 100
	if l := r.URL.Query().Get("lines"); l != "" {
		if v, err := strconv.Atoi(l); err == nil {
			lines = v
		}
	}

	since := r.URL.Query().Get("since")

	logs, err := h.docker.GetLogs(r.Context(), service, lines, since)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"service": service,
		"lines":   logs,
	})
}

// GET /api/logs/{service}/stream (WebSocket)
func (h *LogsHandler) StreamLogs(w http.ResponseWriter, r *http.Request) {
	service := r.PathValue("service")
	if service == "" {
		writeError(w, http.StatusBadRequest, "service name required")
		return
	}

	conn, err := upgradeWebSocket(w, r)
	if err != nil {
		return
	}
	defer conn.Close()

	log.Printf("[WS] Log stream started for %s", service)

	reader, err := h.docker.StreamLogs(r.Context(), service)
	if err != nil {
		conn.WriteJSON(map[string]string{"error": err.Error()})
		return
	}
	defer reader.Close()

	buf := make([]byte, 4096)
	for {
		n, err := reader.Read(buf)
		if err != nil {
			return
		}
		if n > 0 {
			// Strip Docker log header (8 bytes)
			data := buf[:n]
			if n > 8 {
				data = buf[8:n]
			}
			if err := conn.WriteMessage(1, data); err != nil {
				return
			}
		}
	}
}

// GET /api/logs/all (combined logs from all services)
func (h *LogsHandler) GetAllLogs(w http.ResponseWriter, r *http.Request) {
	services, err := h.docker.ListServices(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	lines := 20
	if l := r.URL.Query().Get("lines"); l != "" {
		if v, err := strconv.Atoi(l); err == nil {
			lines = v
		}
	}

	allLogs := make(map[string]string)
	for _, svc := range services {
		if svc.Status == "running" {
			logs, err := h.docker.GetLogs(r.Context(), svc.Name, lines, "")
			if err != nil {
				allLogs[svc.Name] = "Error: " + err.Error()
			} else {
				allLogs[svc.Name] = logs
			}
		}
	}

	writeJSON(w, http.StatusOK, allLogs)
}

// GET /api/logs/all/stream (WebSocket - combined stream)
func (h *LogsHandler) StreamAllLogs(w http.ResponseWriter, r *http.Request) {
	conn, err := upgradeWebSocket(w, r)
	if err != nil {
		return
	}
	defer conn.Close()

	log.Printf("[WS] Combined log stream started")

	services, err := h.docker.ListServices(r.Context())
	if err != nil {
		conn.WriteJSON(map[string]string{"error": err.Error()})
		return
	}

	// Stream logs from each running service
	for _, svc := range services {
		if svc.Status != "running" {
			continue
		}

		go func(name string) {
			reader, err := h.docker.StreamLogs(r.Context(), name)
			if err != nil {
				return
			}
			defer reader.Close()

			buf := make([]byte, 4096)
			for {
				n, err := reader.Read(buf)
				if err != nil {
					return
				}
				if n > 8 {
					line := string(buf[8:n])
					conn.WriteJSON(map[string]string{
						"service":   name,
						"line":      line,
						"timestamp": time.Now().Format(time.RFC3339),
					})
				}
			}
		}(svc.Name)
	}

	// Keep connection alive
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			return
		}
	}
}
