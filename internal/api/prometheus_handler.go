package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

type PrometheusHandler struct {
	prometheusURL   string
	alertmanagerURL string
	httpClient      *http.Client
}

func NewPrometheusHandler(prometheusURL, alertmanagerURL string) *PrometheusHandler {
	return &PrometheusHandler{
		prometheusURL:   prometheusURL,
		alertmanagerURL: alertmanagerURL,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// GET /api/prometheus/query?query=...&time=...
func (h *PrometheusHandler) Query(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("query")
	if query == "" {
		writeError(w, http.StatusBadRequest, "missing query parameter")
		return
	}

	reqURL := fmt.Sprintf("%s/api/v1/query?query=%s", h.prometheusURL, url.QueryEscape(query))
	if t := r.URL.Query().Get("time"); t != "" {
		reqURL += "&time=" + t
	}

	h.proxyGet(w, reqURL)
}

// GET /api/prometheus/query_range?query=...&start=...&end=...&step=...
func (h *PrometheusHandler) QueryRange(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("query")
	if query == "" {
		writeError(w, http.StatusBadRequest, "missing query parameter")
		return
	}

	start := r.URL.Query().Get("start")
	end := r.URL.Query().Get("end")
	step := r.URL.Query().Get("step")

	if start == "" || end == "" || step == "" {
		writeError(w, http.StatusBadRequest, "missing start, end, or step parameter")
		return
	}

	reqURL := fmt.Sprintf("%s/api/v1/query_range?query=%s&start=%s&end=%s&step=%s",
		h.prometheusURL, url.QueryEscape(query), start, end, step)

	h.proxyGet(w, reqURL)
}

// GET /api/prometheus/alerts
func (h *PrometheusHandler) Alerts(w http.ResponseWriter, r *http.Request) {
	url := fmt.Sprintf("%s/api/v1/alerts", h.prometheusURL)
	h.proxyGet(w, url)
}

// GET /api/prometheus/rules
func (h *PrometheusHandler) Rules(w http.ResponseWriter, r *http.Request) {
	url := fmt.Sprintf("%s/api/v1/rules", h.prometheusURL)
	h.proxyGet(w, url)
}

// GET /api/alertmanager/alerts
func (h *PrometheusHandler) AlertmanagerAlerts(w http.ResponseWriter, r *http.Request) {
	url := fmt.Sprintf("%s/api/v2/alerts", h.alertmanagerURL)
	h.proxyGet(w, url)
}

// GET /api/alertmanager/silences
func (h *PrometheusHandler) AlertmanagerSilences(w http.ResponseWriter, r *http.Request) {
	url := fmt.Sprintf("%s/api/v2/silences", h.alertmanagerURL)
	h.proxyGet(w, url)
}

// GET /api/prometheus/targets
func (h *PrometheusHandler) Targets(w http.ResponseWriter, r *http.Request) {
	url := fmt.Sprintf("%s/api/v1/targets", h.prometheusURL)
	h.proxyGet(w, url)
}

func (h *PrometheusHandler) proxyGet(w http.ResponseWriter, url string) {
	resp, err := h.httpClient.Get(url)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]interface{}{
			"status": "error",
			"error":  fmt.Sprintf("prometheus unreachable: %v", err),
		})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to read response")
		return
	}

	// Try to parse as JSON and forward
	var result interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		// Not JSON, forward as-is
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(resp.StatusCode)
		w.Write(body)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	w.Write(body)
}
