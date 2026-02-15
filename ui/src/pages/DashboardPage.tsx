import { useState, useEffect } from 'react'
import { services, versions } from '../services/api'
import type { ServiceInfo, VersionInfo } from '../types'
import StatusBadge from '../components/Services/StatusBadge'
import DataTable from '../components/Services/DataTable'
import PageHeader from '../components/Layout/PageHeader'
import TabBar from '../components/Layout/TabBar'
import { ArrowPathIcon, EllipsisVerticalIcon } from '@heroicons/react/24/outline'

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [servicesList, setServicesList] = useState<ServiceInfo[]>([])
  const [versionInfos, setVersionInfos] = useState<VersionInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [restarting, setRestarting] = useState<string | null>(null)
  const [actionOpen, setActionOpen] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const [svc, ver] = await Promise.all([services.list(), versions.list()])
        setServicesList(svc)
        setVersionInfos(ver)
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const updatesAvailable = versionInfos.filter((v) => v.update_available).length
  const running = servicesList.filter((s) => s.status === 'running').length
  const stopped = servicesList.filter((s) => s.status === 'stopped').length

  async function handleRestart(name: string) {
    setRestarting(name)
    setActionOpen(null)
    try {
      await services.restart(name)
      const svc = await services.list()
      setServicesList(svc)
    } catch (err) {
      console.error('Restart failed:', err)
    } finally {
      setRestarting(null)
    }
  }

  const summaryCards = [
    { label: 'Total Services', value: servicesList.length, className: 'text-cp-gray-700' },
    { label: 'Running', value: running, className: 'text-cp-green' },
    { label: 'Stopped', value: stopped, className: 'text-cp-red' },
    { label: 'Updates Available', value: updatesAvailable, className: 'text-cp-blue' },
  ]

  const columns = [
    {
      key: 'name',
      header: 'Service',
      render: (item: ServiceInfo) => (
        <span className="font-medium text-cp-gray-900">{item.name}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: ServiceInfo) => <StatusBadge status={item.status} />,
    },
    {
      key: 'version',
      header: 'Version / Tag',
      render: (item: ServiceInfo) => (
        <span className="text-cp-gray-600">{item.tag || '-'}</span>
      ),
    },
    {
      key: 'uptime',
      header: 'Uptime',
      render: (item: ServiceInfo) => (
        <span className="text-cp-gray-600">{item.uptime || '-'}</span>
      ),
    },
    {
      key: 'ports',
      header: 'Ports',
      render: (item: ServiceInfo) => (
        <span className="text-cp-gray-600 font-mono text-xs">{item.ports || '-'}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (item: ServiceInfo) => (
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setActionOpen(actionOpen === item.name ? null : item.name)
            }}
            className="p-1 rounded hover:bg-cp-gray-100 text-cp-gray-500"
          >
            <EllipsisVerticalIcon className="w-5 h-5" />
          </button>
          {actionOpen === item.name && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setActionOpen(null)}
              />
              <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-lg border border-cp-gray-200 shadow-lg py-1 min-w-[120px]">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRestart(item.name)
                  }}
                  disabled={restarting === item.name}
                  className="w-full px-4 py-2 text-left text-sm text-cp-gray-700 hover:bg-cp-gray-50 flex items-center gap-2 disabled:opacity-50"
                >
                  <ArrowPathIcon
                    className={`w-4 h-4 ${restarting === item.name ? 'animate-spin' : ''}`}
                  />
                  Restart
                </button>
              </div>
            </>
          )}
        </div>
      ),
      className: 'w-12',
    },
  ]

  return (
    <div className="bg-white min-h-screen">
      <PageHeader title="Dashboard" />
      <TabBar
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'metrics', label: 'System Metrics' },
        ]}
        active={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'overview' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className="bg-white rounded-lg border border-cp-gray-200 p-4"
              >
                <p className="text-xs font-medium text-cp-gray-500 uppercase tracking-wider">
                  {card.label}
                </p>
                <p className={`text-2xl font-semibold mt-1 ${card.className}`}>
                  {loading ? '—' : card.value}
                </p>
              </div>
            ))}
          </div>

          <DataTable
            columns={columns}
            data={servicesList}
            keyFn={(item) => item.name}
            emptyMessage={loading ? 'Loading...' : 'No services found'}
          />
        </>
      )}

      {activeTab === 'metrics' && (
        <div className="bg-white rounded-lg border border-cp-gray-200 p-12 text-center">
          <p className="text-cp-gray-500 text-sm">Coming soon</p>
        </div>
      )}
    </div>
  )
}
