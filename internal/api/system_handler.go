package api

import (
	"fmt"
	"net/http"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

type SystemHandler struct{}

func NewSystemHandler() *SystemHandler {
	return &SystemHandler{}
}

// GET /api/system
func (h *SystemHandler) GetSystem(w http.ResponseWriter, r *http.Request) {
	info := map[string]interface{}{
		"timestamp": time.Now().Format(time.RFC3339),
		"os":        runtime.GOOS,
		"arch":      runtime.GOARCH,
	}

	// CPU info
	if uptime, err := runCmd("uptime"); err == nil {
		info["uptime"] = strings.TrimSpace(uptime)
	}

	// Memory
	if mem, err := runCmd("free", "-m"); err == nil {
		info["memory"] = strings.TrimSpace(mem)
	}

	// Disk
	if disk, err := runCmd("df", "-h", "/"); err == nil {
		info["disk"] = strings.TrimSpace(disk)
	}

	// Temperature (Raspberry Pi)
	if temp, err := runCmd("cat", "/sys/class/thermal/thermal_zone0/temp"); err == nil {
		info["temperature_raw"] = strings.TrimSpace(temp)
	}

	// IP
	if ip, err := runCmd("hostname", "-I"); err == nil {
		info["ip"] = strings.TrimSpace(strings.Split(ip, " ")[0])
	}

	// Hostname
	if hostname, err := runCmd("hostname"); err == nil {
		info["hostname"] = strings.TrimSpace(hostname)
	}

	// Raspberry Pi model
	if model, err := runCmd("cat", "/proc/device-tree/model"); err == nil {
		info["model"] = strings.TrimSpace(model)
	}

	writeJSON(w, http.StatusOK, info)
}

// GET /api/system/health
func (h *SystemHandler) Health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":    "healthy",
		"timestamp": time.Now().Format(time.RFC3339),
		"version":   Version,
		"commit":    Commit,
		"build":     BuildTime,
	})
}

// Build info (injected at compile time via ldflags)
var (
	Version   = "dev"
	Commit    = "unknown"
	BuildTime = "unknown"
)

func runCmd(name string, args ...string) (string, error) {
	cmd := exec.Command(name, args...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("%v: %s", err, string(out))
	}
	return string(out), nil
}
