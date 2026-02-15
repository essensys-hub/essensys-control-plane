package metrics

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	// HTTP metrics
	HTTPRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "essensys_cp_http_requests_total",
			Help: "Total HTTP requests",
		},
		[]string{"method", "path", "status"},
	)

	HTTPRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "essensys_cp_http_request_duration_seconds",
			Help:    "HTTP request duration in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "path"},
	)

	// Redis metrics
	RedisOperationsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "essensys_cp_redis_operations_total",
			Help: "Total Redis operations from Control Plane",
		},
		[]string{"operation"},
	)

	// Docker metrics
	DockerContainersTotal = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "essensys_cp_docker_containers",
			Help: "Number of Docker containers by state",
		},
		[]string{"state"},
	)

	// Version info
	VersionInfo = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "essensys_cp_version_info",
			Help: "Control Plane version information",
		},
		[]string{"version", "commit"},
	)
)

func Init(version, commit string) {
	prometheus.MustRegister(
		HTTPRequestsTotal,
		HTTPRequestDuration,
		RedisOperationsTotal,
		DockerContainersTotal,
		VersionInfo,
	)

	VersionInfo.WithLabelValues(version, commit).Set(1)
}

// Handler returns the Prometheus metrics HTTP handler
func Handler() http.Handler {
	return promhttp.Handler()
}
