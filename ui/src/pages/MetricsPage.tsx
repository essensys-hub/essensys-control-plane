import { useState, useEffect, useCallback } from 'react'
import { prometheus } from '../services/api'
import PageHeader from '../components/Layout/PageHeader'
import TabBar from '../components/Layout/TabBar'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { ArrowPathIcon } from '@heroicons/react/24/outline'

interface ChartData {
  time: string
  timestamp: number
  value: number
}

interface MetricPanel {
  title: string
  query: string
  unit: string
  color: string
  formatter?: (v: number) => string
  type?: 'line' | 'area'
}

const RANGES = [
  { label: '1h', seconds: 3600, step: 60 },
  { label: '6h', seconds: 21600, step: 300 },
  { label: '24h', seconds: 86400, step: 900 },
  { label: '7d', seconds: 604800, step: 3600 },
]

const SYSTEM_PANELS: MetricPanel[] = [
  {
    title: 'CPU Usage',
    query: '100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)',
    unit: '%',
    color: '#3b82f6',
    type: 'area',
    formatter: (v) => `${v.toFixed(1)}%`,
  },
  {
    title: 'Memory Usage',
    query: '(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100',
    unit: '%',
    color: '#8b5cf6',
    type: 'area',
    formatter: (v) => `${v.toFixed(1)}%`,
  },
  {
    title: 'Disk Usage (/)',
    query: '(1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100',
    unit: '%',
    color: '#f59e0b',
    type: 'area',
    formatter: (v) => `${v.toFixed(1)}%`,
  },
  {
    title: 'System Load (5m)',
    query: 'node_load5',
    unit: '',
    color: '#ef4444',
    type: 'line',
    formatter: (v) => v.toFixed(2),
  },
  {
    title: 'Temperature',
    query: 'node_hwmon_temp_celsius',
    unit: '°C',
    color: '#f97316',
    type: 'line',
    formatter: (v) => `${v.toFixed(1)}°C`,
  },
  {
    title: 'Network Received (eth0)',
    query: 'rate(node_network_receive_bytes_total{device="eth0"}[5m]) / 1024',
    unit: 'KB/s',
    color: '#10b981',
    type: 'area',
    formatter: (v) => `${v.toFixed(1)} KB/s`,
  },
]

const API_PANELS: MetricPanel[] = [
  {
    title: 'Control Plane - Requests/sec',
    query: 'sum(rate(essensys_cp_http_requests_total[5m]))',
    unit: 'req/s',
    color: '#3b82f6',
    type: 'line',
    formatter: (v) => `${v.toFixed(2)} req/s`,
  },
  {
    title: 'Control Plane - Latency p95',
    query: 'histogram_quantile(0.95, rate(essensys_cp_http_request_duration_seconds_bucket[5m]))',
    unit: 's',
    color: '#8b5cf6',
    type: 'line',
    formatter: (v) => `${(v * 1000).toFixed(0)}ms`,
  },
  {
    title: 'Backend - Requests/sec',
    query: 'sum(rate(essensys_backend_http_requests_total[5m]))',
    unit: 'req/s',
    color: '#10b981',
    type: 'line',
    formatter: (v) => `${v.toFixed(2)} req/s`,
  },
  {
    title: 'Backend - Latency p95',
    query: 'histogram_quantile(0.95, rate(essensys_backend_http_request_duration_seconds_bucket[5m]))',
    unit: 's',
    color: '#ef4444',
    type: 'line',
    formatter: (v) => `${(v * 1000).toFixed(0)}ms`,
  },
  {
    title: 'Backend - Active Connections',
    query: 'essensys_backend_active_connections',
    unit: '',
    color: '#f59e0b',
    type: 'area',
    formatter: (v) => v.toFixed(0),
  },
  {
    title: 'Traefik - Requests/sec',
    query: 'sum(rate(traefik_service_requests_total[5m]))',
    unit: 'req/s',
    color: '#06b6d4',
    type: 'line',
    formatter: (v) => `${v.toFixed(2)} req/s`,
  },
]

function formatTime(ts: number): string {
  const d = new Date(ts * 1000)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function MetricChart({ panel, range }: { panel: MetricPanel; range: typeof RANGES[number] }) {
  const [data, setData] = useState<ChartData[]>([])
  const [currentValue, setCurrentValue] = useState<string>('—')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const end = Math.floor(Date.now() / 1000)
      const start = end - range.seconds
      const res = await prometheus.queryRange(panel.query, start, end, range.step)

      if (res.status === 'success' && res.data.result.length > 0) {
        const values = res.data.result[0].values
        const chartData = values.map(([ts, val]: [number, string]) => ({
          time: formatTime(ts),
          timestamp: ts,
          value: parseFloat(val) || 0,
        }))
        setData(chartData)
        const last = chartData[chartData.length - 1]
        if (last && panel.formatter) {
          setCurrentValue(panel.formatter(last.value))
        } else if (last) {
          setCurrentValue(last.value.toFixed(2))
        }
      } else {
        setData([])
        setCurrentValue('N/A')
      }
    } catch {
      setError('Prometheus unreachable')
      setData([])
      setCurrentValue('—')
    } finally {
      setLoading(false)
    }
  }, [panel.query, range, panel.formatter])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const ChartComponent = panel.type === 'area' ? AreaChart : LineChart

  return (
    <div className="bg-white rounded-lg border border-cp-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-medium text-cp-gray-700">{panel.title}</h3>
          <p className="text-2xl font-semibold text-cp-gray-900 mt-0.5">
            {loading ? '—' : currentValue}
          </p>
        </div>
      </div>

      {error ? (
        <div className="h-32 flex items-center justify-center text-cp-gray-400 text-xs">
          {error}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={140}>
          <ChartComponent data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
              width={45}
              tickFormatter={(v) => panel.formatter ? panel.formatter(v) : String(v)}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              formatter={(value) => [panel.formatter ? panel.formatter(Number(value)) : value, panel.title]}
              labelFormatter={(label) => `Time: ${label}`}
            />
            {panel.type === 'area' ? (
              <Area
                type="monotone"
                dataKey="value"
                stroke={panel.color}
                fill={panel.color}
                fillOpacity={0.1}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ) : (
              <Line
                type="monotone"
                dataKey="value"
                stroke={panel.color}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            )}
          </ChartComponent>
        </ResponsiveContainer>
      )}
    </div>
  )
}

function TargetsStatus() {
  const [targets, setTargets] = useState<Array<{ labels: Record<string, string>; health: string; lastScrape: string; scrapeUrl: string }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      try {
        const res = await prometheus.targets()
        if (res.status === 'success') {
          setTargets(res.data.activeTargets)
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  return (
    <div className="bg-white rounded-lg border border-cp-gray-200">
      <div className="px-4 py-3 border-b border-cp-gray-100">
        <h3 className="text-sm font-medium text-cp-gray-700">Scrape Targets</h3>
      </div>
      <div className="divide-y divide-cp-gray-100">
        {loading ? (
          <div className="p-4 text-sm text-cp-gray-400">Loading...</div>
        ) : targets.length === 0 ? (
          <div className="p-4 text-sm text-cp-gray-400">No targets found</div>
        ) : (
          targets.map((t, i) => (
            <div key={i} className="px-4 py-2.5 flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-cp-gray-800">
                  {t.labels.job || 'unknown'}
                </span>
                <span className="text-xs text-cp-gray-400 ml-2">
                  {t.labels.instance || t.scrapeUrl}
                </span>
              </div>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  t.health === 'up'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {t.health}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function MetricsPage() {
  const [activeTab, setActiveTab] = useState('system')
  const [rangeIdx, setRangeIdx] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)

  const currentRange = RANGES[rangeIdx]
  const panels = activeTab === 'system' ? SYSTEM_PANELS : API_PANELS

  return (
    <div className="bg-white min-h-screen">
      <PageHeader
        title="Metrics"
        description="Monitoring system and application metrics via Prometheus"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex bg-cp-gray-100 rounded-lg p-0.5">
              {RANGES.map((r, i) => (
                <button
                  key={r.label}
                  onClick={() => setRangeIdx(i)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    i === rangeIdx
                      ? 'bg-white text-cp-gray-900 shadow-sm'
                      : 'text-cp-gray-500 hover:text-cp-gray-700'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              className="p-2 rounded-lg border border-cp-gray-200 text-cp-gray-500 hover:bg-cp-gray-50"
              title="Refresh"
            >
              <ArrowPathIcon className="w-4 h-4" />
            </button>
          </div>
        }
      />

      <TabBar
        tabs={[
          { id: 'system', label: 'System' },
          { id: 'api', label: 'Applications' },
          { id: 'targets', label: 'Targets' },
        ]}
        active={activeTab}
        onChange={setActiveTab}
      />

      {(activeTab === 'system' || activeTab === 'api') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" key={refreshKey}>
          {panels.map((panel) => (
            <MetricChart key={panel.title} panel={panel} range={currentRange} />
          ))}
        </div>
      )}

      {activeTab === 'targets' && <TargetsStatus />}
    </div>
  )
}
