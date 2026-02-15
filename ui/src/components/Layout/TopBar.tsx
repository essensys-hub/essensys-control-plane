import { useEffect, useState } from 'react'
import { BellIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'
import { system } from '../../services/api'
import type { HealthInfo } from '../../types'

export default function TopBar() {
  const [health, setHealth] = useState<HealthInfo | null>(null)

  useEffect(() => {
    system.health().then(setHealth).catch(() => {})
  }, [])

  return (
    <header className="h-14 bg-white border-b border-cp-gray-200 flex items-center justify-between px-6 fixed top-0 left-56 right-0 z-40">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-cp-gray-700">
          {health?.version && `v${health.version}`}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${health?.status === 'healthy' ? 'bg-cp-green' : 'bg-cp-red'}`} />
          <span className="text-xs text-cp-gray-500">
            {health?.status === 'healthy' ? 'Healthy' : 'Offline'}
          </span>
        </div>
        <button className="p-2 text-cp-gray-400 hover:text-cp-gray-700 transition-colors">
          <BellIcon className="w-5 h-5" />
        </button>
        <button className="p-2 text-cp-gray-400 hover:text-cp-gray-700 transition-colors">
          <Cog6ToothIcon className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}
