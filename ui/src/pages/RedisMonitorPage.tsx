import { useState, useEffect } from 'react'
import { redisMonitor } from '../services/api'
import type { RedisInfo, KeyInfo } from '../types'
import PageHeader from '../components/Layout/PageHeader'
import TabBar from '../components/Layout/TabBar'
import DataTable from '../components/Services/DataTable'
import { ArrowDownTrayIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline'

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const parts = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (mins > 0) parts.push(`${mins}m`)
  return parts.length ? parts.join(' ') : '< 1m'
}

export default function RedisMonitorPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [info, setInfo] = useState<RedisInfo | null>(null)
  const [keys, setKeys] = useState<KeyInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [backingUp, setBackingUp] = useState(false)
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    if (activeTab !== 'overview') return
    async function fetchInfo() {
      setLoading(true)
      try {
        const data = await redisMonitor.info()
        setInfo(data)
      } catch (err) {
        console.error('Failed to fetch Redis info:', err)
        setInfo(null)
      } finally {
        setLoading(false)
      }
    }
    fetchInfo()
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'keys') return
    async function fetchKeys() {
      setLoading(true)
      try {
        const data = await redisMonitor.keys()
        setKeys(data)
      } catch (err) {
        console.error('Failed to fetch Redis keys:', err)
        setKeys([])
      } finally {
        setLoading(false)
      }
    }
    fetchKeys()
  }, [activeTab])

  async function handleBackup() {
    setBackingUp(true)
    try {
      const data = await redisMonitor.backup()
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `redis-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Backup failed:', err)
    } finally {
      setBackingUp(false)
    }
  }

  async function handleRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setRestoring(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text) as Record<string, unknown>
      await redisMonitor.restore(data)
      if (activeTab === 'keys') {
        const data = await redisMonitor.keys()
        setKeys(data)
      }
    } catch (err) {
      console.error('Restore failed:', err)
    } finally {
      setRestoring(false)
      e.target.value = ''
    }
  }

  const keyColumns = [
    {
      key: 'key',
      header: 'Key',
      render: (item: KeyInfo) => (
        <span className="font-mono text-sm text-cp-gray-900">{item.key}</span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (item: KeyInfo) => (
        <span className="text-cp-gray-600">{item.type}</span>
      ),
    },
    {
      key: 'size',
      header: 'Size',
      render: (item: KeyInfo) => (
        <span className="text-cp-gray-600">{item.size}</span>
      ),
    },
    {
      key: 'ttl',
      header: 'TTL',
      render: (item: KeyInfo) => (
        <span className="text-cp-gray-600">
          {item.ttl >= 0 ? item.ttl : '—'}
        </span>
      ),
    },
  ]

  return (
    <div className="bg-white min-h-screen">
      <PageHeader title="Redis Monitor" />
      <TabBar
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'keys', label: 'Keys' },
          { id: 'backup', label: 'Backup/Restore' },
        ]}
        active={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-lg border border-cp-gray-200 p-4">
              <p className="text-xs font-medium text-cp-gray-500 uppercase tracking-wider">
                Memory
              </p>
              <p className="text-xl font-semibold text-cp-gray-900 mt-1">
                {loading ? '—' : info?.used_memory_human ?? '—'}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-cp-gray-200 p-4">
              <p className="text-xs font-medium text-cp-gray-500 uppercase tracking-wider">
                Ops/sec
              </p>
              <p className="text-xl font-semibold text-cp-gray-900 mt-1">
                {loading ? '—' : info?.ops_per_sec ?? '—'}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-cp-gray-200 p-4">
              <p className="text-xs font-medium text-cp-gray-500 uppercase tracking-wider">
                Connected Clients
              </p>
              <p className="text-xl font-semibold text-cp-gray-900 mt-1">
                {loading ? '—' : info?.connected_clients ?? '—'}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-cp-gray-200 p-4">
              <p className="text-xs font-medium text-cp-gray-500 uppercase tracking-wider">
                Total Keys
              </p>
              <p className="text-xl font-semibold text-cp-gray-900 mt-1">
                {loading ? '—' : info?.total_keys ?? '—'}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-cp-gray-200 p-4">
              <p className="text-xs font-medium text-cp-gray-500 uppercase tracking-wider">
                Latency
              </p>
              <p className="text-xl font-semibold text-cp-gray-900 mt-1">
                {loading ? '—' : info?.latency_ms != null ? `${info.latency_ms} ms` : '—'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-cp-gray-600">
            <span>
              <strong className="text-cp-gray-700">Version:</strong>{' '}
              {info?.version ?? '—'}
            </span>
            <span>
              <strong className="text-cp-gray-700">Uptime:</strong>{' '}
              {info ? formatUptime(info.uptime_seconds) : '—'}
            </span>
          </div>
        </div>
      )}

      {activeTab === 'keys' && (
        <DataTable
          columns={keyColumns}
          data={keys}
          keyFn={(item) => item.key}
          emptyMessage={loading ? 'Loading...' : 'No keys found'}
        />
      )}

      {activeTab === 'backup' && (
        <div className="flex flex-wrap gap-4">
          <button
            onClick={handleBackup}
            disabled={backingUp}
            className="inline-flex items-center gap-2 px-4 py-2 bg-cp-blue text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            <ArrowDownTrayIcon
              className={`w-5 h-5 ${backingUp ? 'animate-spin' : ''}`}
            />
            Backup
          </button>
          <label className="inline-flex items-center gap-2 px-4 py-2 bg-cp-gray-200 text-cp-gray-800 text-sm font-medium rounded-lg hover:bg-cp-gray-300 cursor-pointer disabled:opacity-50 transition-colors">
            <ArrowUpTrayIcon
              className={`w-5 h-5 ${restoring ? 'animate-spin' : ''}`}
            />
            Restore
            <input
              type="file"
              accept=".json"
              onChange={handleRestore}
              disabled={restoring}
              className="sr-only"
            />
          </label>
        </div>
      )}
    </div>
  )
}
