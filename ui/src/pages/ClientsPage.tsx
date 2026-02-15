import { useState, useEffect } from 'react'
import { clients } from '../services/api'
import type { ClientInfo } from '../types'
import StatusBadge from '../components/Services/StatusBadge'
import DataTable from '../components/Services/DataTable'
import PageHeader from '../components/Layout/PageHeader'

export default function ClientsPage() {
  const [clientsList, setClientsList] = useState<ClientInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedClient, setSelectedClient] = useState<ClientInfo | null>(null)

  useEffect(() => {
    loadClients()
  }, [])

  async function loadClients() {
    setLoading(true)
    try {
      const data = await clients.list()
      setClientsList(data)
    } catch (err) {
      console.error('Failed to fetch clients:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleRowClick(client: ClientInfo) {
    setSelectedClient((prev) => (prev?.client_id === client.client_id ? null : client))
  }

  const columns = [
    {
      key: 'client_id',
      header: 'Client ID',
      render: (item: ClientInfo) => (
        <span className="font-medium text-cp-gray-900 font-mono text-sm">{item.client_id}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: ClientInfo) => (
        <StatusBadge status={item.connected ? 'connected' : 'disconnected'} />
      ),
    },
    {
      key: 'ip',
      header: 'IP',
      render: (item: ClientInfo) => (
        <span className="text-cp-gray-600">{item.ip || '—'}</span>
      ),
    },
    {
      key: 'version',
      header: 'Version',
      render: (item: ClientInfo) => (
        <span className="text-cp-gray-600">{item.version || '—'}</span>
      ),
    },
    {
      key: 'last_updated',
      header: 'Last Updated',
      render: (item: ClientInfo) => (
        <span className="text-cp-gray-600">{item.last_updated || '—'}</span>
      ),
    },
    {
      key: 'exchange_count',
      header: 'Exchange Count',
      render: (item: ClientInfo) => (
        <span className="text-cp-gray-600">{item.exchange_count}</span>
      ),
    },
  ]

  return (
    <div className="bg-white min-h-screen">
      <PageHeader title="Clients" />
      <DataTable
        columns={columns}
        data={clientsList}
        keyFn={(item) => item.client_id}
        onRowClick={handleRowClick}
        emptyMessage={loading ? 'Loading...' : 'No clients found'}
      />
      {selectedClient && (
        <div className="mt-6 bg-white rounded-lg border border-cp-gray-200 p-4">
          <h3 className="text-sm font-semibold text-cp-gray-900 mb-3">Client Details</h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-cp-gray-500">Client ID</dt>
              <dd className="font-mono text-cp-gray-900">{selectedClient.client_id}</dd>
            </div>
            <div>
              <dt className="text-cp-gray-500">Status</dt>
              <dd>
                <StatusBadge status={selectedClient.connected ? 'connected' : 'disconnected'} />
              </dd>
            </div>
            <div>
              <dt className="text-cp-gray-500">IP</dt>
              <dd className="text-cp-gray-900">{selectedClient.ip || '—'}</dd>
            </div>
            <div>
              <dt className="text-cp-gray-500">Version</dt>
              <dd className="text-cp-gray-900">{selectedClient.version || '—'}</dd>
            </div>
            <div>
              <dt className="text-cp-gray-500">Last Updated</dt>
              <dd className="text-cp-gray-900">{selectedClient.last_updated || '—'}</dd>
            </div>
            <div>
              <dt className="text-cp-gray-500">Exchange Count</dt>
              <dd className="text-cp-gray-900">{selectedClient.exchange_count}</dd>
            </div>
            {selectedClient.auth && (
              <div>
                <dt className="text-cp-gray-500">Auth</dt>
                <dd className="text-cp-gray-900">{selectedClient.auth}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  )
}
