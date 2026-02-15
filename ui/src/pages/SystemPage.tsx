import { useState, useEffect } from 'react'
import { system } from '../services/api'
import type { SystemInfo } from '../types'
import PageHeader from '../components/Layout/PageHeader'
import TabBar from '../components/Layout/TabBar'

export default function SystemPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (activeTab !== 'overview') return
    async function fetchSystem() {
      setLoading(true)
      try {
        const data = await system.get()
        setSysInfo(data)
      } catch (err) {
        console.error('Failed to fetch system info:', err)
        setSysInfo(null)
      } finally {
        setLoading(false)
      }
    }
    fetchSystem()
  }, [activeTab])

  const infoCards = [
    { label: 'Hostname', value: sysInfo?.hostname ?? '—' },
    { label: 'IP', value: sysInfo?.ip ?? '—' },
    { label: 'Model', value: sysInfo?.model ?? '—' },
    { label: 'OS / Arch', value: sysInfo ? `${sysInfo.os} / ${sysInfo.arch}` : '—' },
    { label: 'Uptime', value: sysInfo?.uptime ?? '—' },
    { label: 'Temperature', value: sysInfo?.temperature_raw ?? '—' },
  ]

  return (
    <div className="bg-white min-h-screen">
      <PageHeader title="System" />
      <TabBar
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'graphs', label: 'Graphs' },
        ]}
        active={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {infoCards.map((card) => (
              <div
                key={card.label}
                className="bg-white rounded-lg border border-cp-gray-200 p-4"
              >
                <p className="text-xs font-medium text-cp-gray-500 uppercase tracking-wider">
                  {card.label}
                </p>
                <p className="text-lg font-medium text-cp-gray-900 mt-1">
                  {loading ? '—' : card.value}
                </p>
              </div>
            ))}
          </div>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-cp-gray-700 mb-2">
                Memory
              </h3>
              <pre className="p-4 bg-cp-gray-100 rounded-lg border border-cp-gray-200 text-xs font-mono text-cp-gray-800 overflow-x-auto">
                {loading ? '—' : sysInfo?.memory ?? '—'}
              </pre>
            </div>
            <div>
              <h3 className="text-sm font-medium text-cp-gray-700 mb-2">
                Disk
              </h3>
              <pre className="p-4 bg-cp-gray-100 rounded-lg border border-cp-gray-200 text-xs font-mono text-cp-gray-800 overflow-x-auto">
                {loading ? '—' : sysInfo?.disk ?? '—'}
              </pre>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'graphs' && (
        <div className="bg-white rounded-lg border border-cp-gray-200 p-12 text-center">
          <p className="text-cp-gray-500 text-sm">
            Prometheus graphs coming soon
          </p>
        </div>
      )}
    </div>
  )
}
