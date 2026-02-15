import { useState, useEffect } from 'react'
import { actions } from '../services/api'
import type { Action } from '../types'
import DataTable from '../components/Services/DataTable'
import PageHeader from '../components/Layout/PageHeader'
import TabBar from '../components/Layout/TabBar'
import { TrashIcon, PlusIcon } from '@heroicons/react/24/outline'

const tabs = [
  { id: 'queue', label: 'Queue' },
  { id: 'history', label: 'History' },
]

export default function ActionsPage() {
  const [activeTab, setActiveTab] = useState('queue')
  const [data, setData] = useState<Action[]>([])
  const [loading, setLoading] = useState(true)
  const [showInject, setShowInject] = useState(false)
  const [injectType, setInjectType] = useState('')
  const [injectParams, setInjectParams] = useState('')

  const fetchData = () => {
    setLoading(true)
    actions.list().then(setData).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  const handlePurge = async () => {
    if (!confirm('Purge all actions?')) return
    await actions.purge()
    fetchData()
  }

  const handleRemove = async (guid: string) => {
    await actions.remove(guid)
    fetchData()
  }

  const handleInject = async () => {
    const action: Partial<Action> = {
      GUID: crypto.randomUUID(),
      type: injectType,
    }
    try {
      if (injectParams) action.params = JSON.parse(injectParams)
    } catch { /* ignore */ }
    await actions.push(action)
    setShowInject(false)
    setInjectType('')
    setInjectParams('')
    fetchData()
  }

  return (
    <div>
      <PageHeader
        title="Actions Queue"
        description="Manage the Redis action queue"
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setShowInject(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-cp-blue text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <PlusIcon className="w-4 h-4" /> Inject
            </button>
            <button
              onClick={handlePurge}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-cp-red text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <TrashIcon className="w-4 h-4" /> Purge
            </button>
          </div>
        }
      />
      <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'queue' && (
        loading ? (
          <p className="text-sm text-cp-gray-400">Loading...</p>
        ) : (
          <DataTable
            columns={[
              { key: 'guid', header: 'GUID', render: (a: Action) => <span className="font-mono text-xs">{a.GUID}</span> },
              { key: 'type', header: 'Type', render: (a: Action) => a.type || '-' },
              { key: 'params', header: 'Params', render: (a: Action) => (
                <span className="font-mono text-xs">{a.params ? JSON.stringify(a.params) : '-'}</span>
              )},
              { key: 'actions', header: '', render: (a: Action) => (
                <button onClick={() => handleRemove(a.GUID)} className="text-cp-red hover:text-red-700">
                  <TrashIcon className="w-4 h-4" />
                </button>
              ), className: 'w-10' },
            ]}
            data={data}
            keyFn={(a: Action) => a.GUID || Math.random().toString()}
            emptyMessage="No pending actions"
          />
        )
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-lg border border-cp-gray-200 p-8 text-center text-cp-gray-400 text-sm">
          Audit log coming soon
        </div>
      )}

      {/* Inject Modal */}
      {showInject && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowInject(false)}>
          <div className="bg-white rounded-xl p-6 w-96 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Inject Action</h3>
            <label className="block text-sm text-cp-gray-600 mb-1">Type</label>
            <input
              value={injectType}
              onChange={e => setInjectType(e.target.value)}
              className="w-full border border-cp-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-cp-blue"
              placeholder="e.g. send_order"
            />
            <label className="block text-sm text-cp-gray-600 mb-1">Params (JSON)</label>
            <textarea
              value={injectParams}
              onChange={e => setInjectParams(e.target.value)}
              className="w-full border border-cp-gray-300 rounded-lg px-3 py-2 text-sm mb-4 font-mono focus:outline-none focus:border-cp-blue"
              rows={3}
              placeholder='{"index": 100, "value": "1"}'
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowInject(false)} className="px-4 py-2 text-sm text-cp-gray-600 hover:bg-cp-gray-100 rounded-lg">Cancel</button>
              <button onClick={handleInject} className="px-4 py-2 text-sm bg-cp-blue text-white rounded-lg hover:bg-blue-700">Inject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
