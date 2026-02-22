import { useState, useEffect } from 'react'
import { services } from '../services/api'
import type { ServiceInfo } from '../types'
import StatusBadge from '../components/Services/StatusBadge'
import DataTable from '../components/Services/DataTable'
import PageHeader from '../components/Layout/PageHeader'
import TabBar from '../components/Layout/TabBar'
import { ArrowPathIcon, EllipsisVerticalIcon } from '@heroicons/react/24/outline'

export default function OpenClawPage() {
    const [activeTab, setActiveTab] = useState('console')
    const [servicesList, setServicesList] = useState<ServiceInfo[]>([])
    const [loading, setLoading] = useState(false)
    const [restarting, setRestarting] = useState<string | null>(null)
    const [actionOpen, setActionOpen] = useState<string | null>(null)

    useEffect(() => {
        if (activeTab === 'services') {
            fetchServices()
        }
    }, [activeTab])

    async function fetchServices() {
        setLoading(true)
        try {
            const svc = await services.list()
            const openclawServices = svc.filter((s) => s.name.includes('openclaw'))
            setServicesList(openclawServices)
        } catch (err) {
            console.error('Failed to fetch services:', err)
        } finally {
            setLoading(false)
        }
    }

    async function handleRestart(name: string) {
        setRestarting(name)
        setActionOpen(null)
        try {
            await services.restart(name)
            await fetchServices()
        } catch (err) {
            console.error('Restart failed:', err)
        } finally {
            setRestarting(null)
        }
    }

    const columns = [
        {
            key: 'name',
            header: 'Service',
            render: (item: ServiceInfo) => <span className="font-medium text-cp-gray-900">{item.name}</span>,
        },
        {
            key: 'status',
            header: 'Status',
            render: (item: ServiceInfo) => <StatusBadge status={item.status} />,
        },
        {
            key: 'uptime',
            header: 'Uptime',
            render: (item: ServiceInfo) => <span className="text-cp-gray-600">{item.uptime || '-'}</span>,
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

    // We connect to the same host but on the OpenClaw port
    const consoleUrl = `http://${window.location.hostname}:18789`

    return (
        <div className="bg-white min-h-screen flex flex-col">
            <PageHeader title="OpenClaw Assistant" />
            <TabBar
                tabs={[
                    { id: 'console', label: 'Console' },
                    { id: 'services', label: 'Services' },
                ]}
                active={activeTab}
                onChange={setActiveTab}
            />

            {activeTab === 'console' && (
                <div className="flex-1 w-full bg-cp-gray-50">
                    <iframe
                        src={consoleUrl}
                        title="OpenClaw Console"
                        className="w-full h-[calc(100vh-140px)] border-none"
                        allow="clipboard-read; clipboard-write"
                    />
                </div>
            )}

            {activeTab === 'services' && (
                <div className="mt-4">
                    <DataTable
                        columns={columns}
                        data={servicesList}
                        keyFn={(item) => item.name}
                        emptyMessage={loading ? 'Loading...' : 'No OpenClaw services found'}
                    />
                </div>
            )}
        </div>
    )
}
