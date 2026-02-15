import { useState, useEffect } from 'react'
import { versions } from '../services/api'
import type { VersionInfo, UpdateHistoryEntry } from '../types'
import StatusBadge from '../components/Services/StatusBadge'
import DataTable from '../components/Services/DataTable'
import PageHeader from '../components/Layout/PageHeader'
import TabBar from '../components/Layout/TabBar'
import { ArrowPathIcon } from '@heroicons/react/24/outline'

export default function VersionsPage() {
  const [activeTab, setActiveTab] = useState('updates')
  const [versionList, setVersionList] = useState<VersionInfo[]>([])
  const [historyList, setHistoryList] = useState<UpdateHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const list = await versions.list()
        setVersionList(list)
      } catch (err) {
        console.error('Failed to fetch versions:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    if (activeTab !== 'history') return
    async function fetchHistory() {
      setLoading(true)
      try {
        const history = await versions.history()
        setHistoryList(history)
      } catch (err) {
        console.error('Failed to fetch update history:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchHistory()
  }, [activeTab])

  async function handleCheckUpdates() {
    setChecking(true)
    try {
      const result = await versions.check()
      setVersionList(result.versions)
    } catch (err) {
      console.error('Check updates failed:', err)
    } finally {
      setChecking(false)
    }
  }

  const updateColumns = [
    {
      key: 'application',
      header: 'Application',
      render: (item: VersionInfo) => (
        <span className="font-medium text-cp-gray-900">{item.service}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: VersionInfo) => (
        <StatusBadge
          status={item.update_available ? 'Update Available' : 'Up to Date'}
        />
      ),
    },
    {
      key: 'version',
      header: 'Version',
      render: (item: VersionInfo) => (
        <span className="text-cp-gray-600">{item.installed_tag || '-'}</span>
      ),
    },
    {
      key: 'available',
      header: 'Available',
      render: (item: VersionInfo) => (
        <span className="text-cp-gray-600">{item.available_tag || '-'}</span>
      ),
    },
    {
      key: 'channel',
      header: 'Release Channel',
      render: (item: VersionInfo) => (
        <span className="text-cp-gray-600">{item.release_channel || '-'}</span>
      ),
    },
    {
      key: 'autoUpdate',
      header: 'Auto Update',
      render: () => (
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" className="sr-only peer" readOnly />
          <div className="w-9 h-5 bg-cp-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-cp-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cp-blue" />
        </label>
      ),
    },
  ]

  const historyColumns = [
    {
      key: 'timestamp',
      header: 'Date',
      render: (item: UpdateHistoryEntry) => (
        <span className="text-cp-gray-600">{item.timestamp}</span>
      ),
    },
    {
      key: 'service',
      header: 'Application',
      render: (item: UpdateHistoryEntry) => (
        <span className="font-medium text-cp-gray-900">{item.service}</span>
      ),
    },
    {
      key: 'from',
      header: 'From',
      render: (item: UpdateHistoryEntry) => (
        <span className="text-cp-gray-600 font-mono text-xs">{item.from_tag}</span>
      ),
    },
    {
      key: 'to',
      header: 'To',
      render: (item: UpdateHistoryEntry) => (
        <span className="text-cp-gray-600 font-mono text-xs">{item.to_tag}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: UpdateHistoryEntry) => <StatusBadge status={item.status} />,
    },
    {
      key: 'details',
      header: 'Details',
      render: (item: UpdateHistoryEntry) => (
        <span className="text-cp-gray-500 text-xs">{item.details || '-'}</span>
      ),
    },
  ]

  return (
    <div className="bg-white min-h-screen">
      <PageHeader
        title="Updates"
        actions={
          <button
            onClick={handleCheckUpdates}
            disabled={checking}
            className="inline-flex items-center gap-2 px-4 py-2 bg-cp-blue text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-colors"
          >
            <ArrowPathIcon
              className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`}
            />
            Check Updates
          </button>
        }
      />
      <TabBar
        tabs={[
          { id: 'updates', label: 'Updates' },
          { id: 'history', label: 'History' },
        ]}
        active={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'updates' && (
        <DataTable
          columns={updateColumns}
          data={versionList}
          keyFn={(item) => item.service}
          emptyMessage={loading ? 'Loading...' : 'No applications found'}
        />
      )}

      {activeTab === 'history' && (
        <DataTable
          columns={historyColumns}
          data={historyList}
          keyFn={(item) => `${item.id}-${item.timestamp}`}
          emptyMessage={loading ? 'Loading...' : 'No update history'}
        />
      )}
    </div>
  )
}
