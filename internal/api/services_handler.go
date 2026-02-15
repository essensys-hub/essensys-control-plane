package api

import (
	"encoding/json"
	"net/http"

	"github.com/essensys-hub/essensys-control-plane/internal/docker"
	"github.com/essensys-hub/essensys-control-plane/internal/store"
)

type ServicesHandler struct {
	docker *docker.Client
	store  *store.Store
}

func NewServicesHandler(d *docker.Client, s *store.Store) *ServicesHandler {
	return &ServicesHandler{docker: d, store: s}
}

// GET /api/services
func (h *ServicesHandler) List(w http.ResponseWriter, r *http.Request) {
	services, err := h.docker.ListServices(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, services)
}

// GET /api/services/{name}
func (h *ServicesHandler) Get(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if name == "" {
		writeError(w, http.StatusBadRequest, "service name required")
		return
	}

	svc, details, err := h.docker.InspectService(r.Context(), name)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"service": svc,
		"details": details,
	})
}

// POST /api/services/{name}/restart
func (h *ServicesHandler) Restart(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if name == "" {
		writeError(w, http.StatusBadRequest, "service name required")
		return
	}

	if err := h.docker.RestartService(r.Context(), name); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.store.LogAudit("restart", "service:"+name, "", "", "api")
	writeOK(w, "Service "+name+" restarted")
}

// POST /api/services/{name}/update
func (h *ServicesHandler) Update(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if name == "" {
		writeError(w, http.StatusBadRequest, "service name required")
		return
	}

	var body struct {
		Tag string `json:"tag"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Tag == "" {
		writeError(w, http.StatusBadRequest, "tag is required")
		return
	}

	// Get current version
	svc, _, _ := h.docker.InspectService(r.Context(), name)
	fromTag := ""
	if svc != nil {
		fromTag = svc.Tag
	}

	// Record update start
	updateID, _ := h.store.RecordUpdate(name, fromTag, body.Tag, "in_progress", "")

	if err := h.docker.PullAndUpdate(r.Context(), name, body.Tag); err != nil {
		h.store.UpdateUpdateStatus(updateID, "failed", err.Error())
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.store.UpdateUpdateStatus(updateID, "success", "")
	h.store.LogAudit("update", "service:"+name, fromTag, body.Tag, "api")
	writeOK(w, "Service "+name+" updated to "+body.Tag)
}

// POST /api/services/{name}/rollback
func (h *ServicesHandler) Rollback(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if name == "" {
		writeError(w, http.StatusBadRequest, "service name required")
		return
	}

	previousTag, err := h.docker.RollbackService(r.Context(), name)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.store.LogAudit("rollback", "service:"+name, "", previousTag, "api")
	writeOK(w, "Service "+name+" rolled back to "+previousTag)
}

// GET /api/versions
func (h *ServicesHandler) Versions(w http.ResponseWriter, r *http.Request) {
	versions, err := h.docker.CheckUpdates(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, versions)
}

// POST /api/update/check
func (h *ServicesHandler) CheckUpdates(w http.ResponseWriter, r *http.Request) {
	versions, err := h.docker.CheckUpdates(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	hasUpdates := false
	for _, v := range versions {
		if v.UpdateAvailable {
			hasUpdates = true
			break
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"updates_available": hasUpdates,
		"versions":          versions,
	})
}

// GET /api/updates/history
func (h *ServicesHandler) UpdateHistory(w http.ResponseWriter, r *http.Request) {
	entries, err := h.store.GetUpdateHistory(50, r.URL.Query().Get("service"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, entries)
}
