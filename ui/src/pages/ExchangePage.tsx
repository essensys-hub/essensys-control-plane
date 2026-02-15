import { useState, useEffect } from 'react'
import { exchange } from '../services/api'
import type { ExchangeEntry } from '../types'
import DataTable from '../components/Services/DataTable'
import PageHeader from '../components/Layout/PageHeader'
import TabBar from '../components/Layout/TabBar'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'

const CLIENT_ID = 'default'

export default function ExchangePage() {
  const [activeTab, setActiveTab] = useState('browse')
  const [tableData, setTableData] = useState<ExchangeEntry[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ExchangeEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const categoryPills = [
    { id: 'all', label: 'All' },
    { id: 'lights', label: 'Lights' },
    { id: 'shutters', label: 'Shutters' },
    { id: 'scenarios', label: 'Scenarios' },
  ]

  useEffect(() => {
    if (activeTab === 'browse') {
      loadTable()
    }
  }, [activeTab])

  async function loadTable() {
    setLoading(true)
    try {
      const data = await exchange.getTable(CLIENT_ID)
      setTableData(data)
    } catch (err) {
      console.error('Failed to fetch exchange table:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return
    setLoading(true)
    try {
      const results = await exchange.search(CLIENT_ID, searchQuery)
      setSearchResults(results)
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setLoading(false)
    }
  }

  function startEdit(entry: ExchangeEntry) {
    setEditingIndex(entry.index)
    setEditValue(entry.value)
  }

  async function saveEdit() {
    if (editingIndex === null) return
    try {
      await exchange.setValue(CLIENT_ID, editingIndex, editValue)
      setTableData((prev) =>
        prev.map((e) => (e.index === editingIndex ? { ...e, value: editValue } : e))
      )
      setSearchResults((prev) =>
        prev.map((e) => (e.index === editingIndex ? { ...e, value: editValue } : e))
      )
    } catch (err) {
      console.error('Failed to save value:', err)
    } finally {
      setEditingIndex(null)
      setEditValue('')
    }
  }

  function handleEditKeyDown(e: React.KeyboardEvent, _index: number) {
    if (e.key === 'Enter') {
      saveEdit()
    }
    if (e.key === 'Escape') {
      setEditingIndex(null)
      setEditValue('')
    }
  }

  const columns = [
    {
      key: 'index',
      header: 'Index',
      render: (item: ExchangeEntry) => (
        <span className="font-mono text-sm text-cp-gray-700">{item.index}</span>
      ),
    },
    {
      key: 'value',
      header: 'Value',
      render: (item: ExchangeEntry) =>
        editingIndex === item.index ? (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={(e) => handleEditKeyDown(e, item.index)}
            className="w-full px-2 py-1 text-sm border border-cp-blue rounded focus:outline-none focus:ring-2 focus:ring-cp-blue"
            autoFocus
          />
        ) : (
          <span
            className="text-cp-gray-900 cursor-pointer hover:bg-cp-gray-50 px-2 py-1 rounded -mx-2 -my-1"
            onClick={() => startEdit(item)}
          >
            {item.value || '—'}
          </span>
        ),
    },
  ]

  return (
    <div className="bg-white min-h-screen">
      <PageHeader title="Exchange Table" />
      <TabBar
        tabs={[
          { id: 'browse', label: 'Browse' },
          { id: 'search', label: 'Search' },
          { id: 'live', label: 'Live View' },
        ]}
        active={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'browse' && (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            {categoryPills.map((pill) => (
              <button
                key={pill.id}
                onClick={() => setCategoryFilter(pill.id)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                  categoryFilter === pill.id
                    ? 'bg-cp-blue text-white'
                    : 'bg-cp-gray-100 text-cp-gray-600 hover:bg-cp-gray-200'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
          <DataTable
            columns={columns}
            data={tableData}
            keyFn={(item) => String(item.index)}
            emptyMessage={loading ? 'Loading...' : 'No exchange entries'}
          />
        </>
      )}

      {activeTab === 'search' && (
        <>
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cp-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search exchange..."
                className="w-full pl-10 pr-4 py-2 border border-cp-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cp-blue focus:border-transparent"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-4 py-2 bg-cp-blue text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              Search
            </button>
          </div>
          <DataTable
            columns={columns}
            data={searchResults}
            keyFn={(item) => String(item.index)}
            emptyMessage={loading ? 'Searching...' : 'Enter a query and search'}
          />
        </>
      )}

      {activeTab === 'live' && (
        <div className="bg-white rounded-lg border border-cp-gray-200 p-12 text-center">
          <p className="text-cp-gray-500 text-sm">WebSocket coming soon</p>
        </div>
      )}
    </div>
  )
}
