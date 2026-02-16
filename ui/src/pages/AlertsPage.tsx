import { useState, useEffect, useCallback } from 'react'
import { prometheus } from '../services/api'
import PageHeader from '../components/Layout/PageHeader'
import TabBar from '../components/Layout/TabBar'
import { ArrowPathIcon } from '@heroicons/react/24/outline'

interface PrometheusAlert {
  labels: Record<string, string>
  annotations: Record<string, string>
  state: string
  activeAt: string
  value: string
}

interface AlertRule {
  name: string
  query: string
  state: string
  alerts: unknown[]
  labels: Record<string, string>
  annotations: Record<string, string>
  type: string
  duration?: number
}

interface RuleGroup {
  name: string
  rules: AlertRule[]
}

function stateColor(state: string) {
  switch (state) {
    case 'firing':
      return 'bg-red-100 text-red-700 border-red-200'
    case 'pending':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    case 'inactive':
      return 'bg-green-100 text-green-700 border-green-200'
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

function severityColor(severity: string) {
  switch (severity) {
    case 'critical':
      return 'bg-red-600 text-white'
    case 'warning':
      return 'bg-yellow-500 text-white'
    case 'info':
      return 'bg-blue-500 text-white'
    default:
      return 'bg-gray-500 text-white'
  }
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return dateStr
  }
}

function ActiveAlerts() {
  const [alerts, setAlerts] = useState<PrometheusAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await prometheus.alerts()
      if (res.status === 'success') {
        setAlerts(res.data.alerts.filter((a) => a.state === 'firing' || a.state === 'pending'))
      }
      setError(null)
    } catch {
      setError('Unable to reach Prometheus')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAlerts()
    const interval = setInterval(fetchAlerts, 15000)
    return () => clearInterval(interval)
  }, [fetchAlerts])

  if (loading) {
    return <div className="p-6 text-sm text-cp-gray-400">Loading alerts...</div>
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
        {error}
      </div>
    )
  }

  if (alerts.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <p className="text-green-700 font-medium">All clear</p>
        <p className="text-green-600 text-sm mt-1">No active alerts</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert, i) => (
        <div
          key={i}
          className={`rounded-lg border p-4 ${stateColor(alert.state)}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${severityColor(alert.labels.severity || 'warning')}`}>
                {(alert.labels.severity || 'warning').toUpperCase()}
              </span>
              <h3 className="font-medium text-sm">
                {alert.labels.alertname}
              </h3>
            </div>
            <span className="text-xs opacity-70">
              {alert.state === 'firing' ? 'FIRING' : 'PENDING'}
            </span>
          </div>
          <p className="text-sm mt-2 opacity-80">
            {alert.annotations.summary || alert.annotations.description || '—'}
          </p>
          <div className="flex items-center gap-4 mt-2 text-xs opacity-60">
            <span>Active since: {formatDate(alert.activeAt)}</span>
            {alert.value && <span>Value: {alert.value}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

function AllRules() {
  const [groups, setGroups] = useState<RuleGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)

  useEffect(() => {
    async function fetch() {
      try {
        const res = await prometheus.rules()
        if (res.status === 'success') {
          setGroups(res.data.groups)
          if (res.data.groups.length > 0) {
            setExpandedGroup(res.data.groups[0].name)
          }
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  if (loading) {
    return <div className="p-6 text-sm text-cp-gray-400">Loading rules...</div>
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.name} className="bg-white rounded-lg border border-cp-gray-200 overflow-hidden">
          <button
            onClick={() => setExpandedGroup(expandedGroup === group.name ? null : group.name)}
            className="w-full px-4 py-3 flex items-center justify-between bg-cp-gray-50 hover:bg-cp-gray-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-cp-gray-800">{group.name}</h3>
              <span className="text-xs text-cp-gray-400">
                {group.rules.length} rule{group.rules.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {group.rules.some((r) => r.state === 'firing') && (
                <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                  {group.rules.filter((r) => r.state === 'firing').length} firing
                </span>
              )}
              {group.rules.some((r) => r.state === 'pending') && (
                <span className="text-xs font-medium bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                  {group.rules.filter((r) => r.state === 'pending').length} pending
                </span>
              )}
              <svg
                className={`w-4 h-4 text-cp-gray-400 transition-transform ${expandedGroup === group.name ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {expandedGroup === group.name && (
            <div className="divide-y divide-cp-gray-100">
              {group.rules.filter((r) => r.type === 'alerting').map((rule, i) => (
                <div key={i} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        rule.state === 'firing' ? 'bg-red-500' :
                        rule.state === 'pending' ? 'bg-yellow-500' : 'bg-green-500'
                      }`} />
                      <span className="text-sm font-medium text-cp-gray-800">{rule.name}</span>
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${severityColor(rule.labels.severity || 'warning')}`}>
                        {rule.labels.severity || 'warning'}
                      </span>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      rule.state === 'firing' ? 'bg-red-100 text-red-700' :
                      rule.state === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {rule.state}
                    </span>
                  </div>
                  {rule.annotations.description && (
                    <p className="text-xs text-cp-gray-500 mt-1 ml-4">
                      {rule.annotations.description}
                    </p>
                  )}
                  <p className="text-xs text-cp-gray-400 mt-1 ml-4 font-mono">
                    {rule.query.length > 100 ? rule.query.substring(0, 100) + '...' : rule.query}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function AlertsPage() {
  const [activeTab, setActiveTab] = useState('active')
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="bg-white min-h-screen">
      <PageHeader
        title="Alerts"
        description="Active alerts and configured alert rules"
        actions={
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="p-2 rounded-lg border border-cp-gray-200 text-cp-gray-500 hover:bg-cp-gray-50"
            title="Refresh"
          >
            <ArrowPathIcon className="w-4 h-4" />
          </button>
        }
      />

      <TabBar
        tabs={[
          { id: 'active', label: 'Active Alerts' },
          { id: 'rules', label: 'Alert Rules' },
        ]}
        active={activeTab}
        onChange={setActiveTab}
      />

      <div key={refreshKey}>
        {activeTab === 'active' && <ActiveAlerts />}
        {activeTab === 'rules' && <AllRules />}
      </div>
    </div>
  )
}
