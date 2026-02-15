import { useState, useEffect } from 'react'
import { logs, services } from '../services/api'
import type { ServiceInfo } from '../types'
import PageHeader from '../components/Layout/PageHeader'
import TabBar from '../components/Layout/TabBar'

export default function LogsPage() {
  const [activeTab, setActiveTab] = useState('all')
  const [allLogs, setAllLogs] = useState<Record<string, string>>({})
  const [serviceLogs, setServiceLogs] = useState<string>('')
  const [selectedService, setSelectedService] = useState<string>('')
  const [serviceList, setServiceList] = useState<ServiceInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAllLogs() {
      setLoading(true)
      try {
        const data = await logs.getAll()
        setAllLogs(data)
      } catch (err) {
        console.error('Failed to fetch logs:', err)
        setAllLogs({})
      } finally {
        setLoading(false)
      }
    }
    fetchAllLogs()
  }, [activeTab === 'all'])

  useEffect(() => {
    async function fetchServices() {
      try {
        const list = await services.list()
        setServiceList(list)
        if (!selectedService && list.length > 0) {
          setSelectedService(list[0].name)
        }
      } catch (err) {
        console.error('Failed to fetch services:', err)
      }
    }
    fetchServices()
  }, [])

  useEffect(() => {
    if (activeTab !== 'by-service' || !selectedService) return
    async function fetchServiceLogs() {
      setLoading(true)
      try {
        const data = await logs.get(selectedService, 200)
        setServiceLogs(data.lines || '')
      } catch (err) {
        console.error('Failed to fetch service logs:', err)
        setServiceLogs('')
      } finally {
        setLoading(false)
      }
    }
    fetchServiceLogs()
  }, [activeTab, selectedService])

  return (
    <div className="bg-white min-h-screen">
      <PageHeader title="Logs" />
      <TabBar
        tabs={[
          { id: 'all', label: 'All Services' },
          { id: 'by-service', label: 'By Service' },
          { id: 'live', label: 'Live Tail' },
        ]}
        active={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'all' && (
        <div className="space-y-6">
          {loading ? (
            <p className="text-sm text-cp-gray-500">Loading logs...</p>
          ) : (
            Object.entries(allLogs).map(([serviceName, content]) => (
              <div
                key={serviceName}
                className="rounded-lg border border-cp-gray-200 overflow-hidden"
              >
                <div className="px-4 py-2.5 bg-cp-gray-100 border-b border-cp-gray-200">
                  <h3 className="text-sm font-medium text-cp-gray-900">
                    {serviceName}
                  </h3>
                </div>
                <pre className="p-4 bg-cp-gray-900 text-cp-gray-100 text-xs font-mono overflow-x-auto max-h-64 overflow-y-auto">
                  {content || '(no logs)'}
                </pre>
              </div>
            ))
          )}
          {!loading && Object.keys(allLogs).length === 0 && (
            <p className="text-sm text-cp-gray-500">No logs available</p>
          )}
        </div>
      )}

      {activeTab === 'by-service' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-cp-gray-700">
              Service
            </label>
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="rounded-lg border border-cp-gray-200 px-3 py-2 text-sm text-cp-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-cp-blue focus:border-transparent"
            >
              {serviceList.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-lg border border-cp-gray-200 overflow-hidden">
            <pre className="p-4 bg-cp-gray-900 text-cp-gray-100 text-xs font-mono overflow-x-auto max-h-[32rem] overflow-y-auto">
              {loading ? 'Loading...' : serviceLogs || '(no logs)'}
            </pre>
          </div>
        </div>
      )}

      {activeTab === 'live' && (
        <div className="bg-white rounded-lg border border-cp-gray-200 p-12 text-center">
          <p className="text-cp-gray-500 text-sm">
            WebSocket live tail coming soon
          </p>
        </div>
      )}
    </div>
  )
}
