import { NavLink } from 'react-router-dom'
import {
  HomeIcon,
  ServerStackIcon,
  TableCellsIcon,
  UsersIcon,
  QueueListIcon,
  DocumentTextIcon,
  CircleStackIcon,
  CpuChipIcon,
  ArrowPathIcon,
  ArchiveBoxIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  BellAlertIcon,
} from '@heroicons/react/24/outline'

const navSections = [
  {
    title: 'System',
    items: [
      { to: '/', icon: HomeIcon, label: 'Dashboard' },
      { to: '/services', icon: ServerStackIcon, label: 'Services' },
    ],
  },
  {
    title: 'Data',
    items: [
      { to: '/exchange', icon: TableCellsIcon, label: 'Exchange Table' },
      { to: '/clients', icon: UsersIcon, label: 'Clients' },
      { to: '/actions', icon: QueueListIcon, label: 'Actions Queue' },
    ],
  },
  {
    title: 'Monitoring',
    items: [
      { to: '/metrics', icon: ChartBarIcon, label: 'Metrics' },
      { to: '/alerts', icon: BellAlertIcon, label: 'Alerts' },
      { to: '/logs', icon: DocumentTextIcon, label: 'Logs' },
      { to: '/redis-monitor', icon: CircleStackIcon, label: 'Redis Monitor' },
      { to: '/system', icon: CpuChipIcon, label: 'System' },
    ],
  },
  {
    title: 'Management',
    items: [
      { to: '/versions', icon: ArrowPathIcon, label: 'Updates' },
      { to: '/backups', icon: ArchiveBoxIcon, label: 'Backups' },
      { to: '/settings', icon: Cog6ToothIcon, label: 'Settings' },
    ],
  },
]

export default function Sidebar() {
  return (
    <aside className="w-56 bg-cp-sidebar text-white flex flex-col h-screen fixed left-0 top-0 z-50">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-cp-blue rounded-lg flex items-center justify-center text-sm font-bold">
            E
          </div>
          <div>
            <div className="text-sm font-semibold">Essensys</div>
            <div className="text-[10px] text-white/50">Control Plane</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        {navSections.map((section) => (
          <div key={section.title} className="mb-1">
            <div className="px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
              {section.title}
            </div>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-5 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-cp-sidebar-active text-white'
                      : 'text-white/60 hover:text-white hover:bg-cp-sidebar-hover'
                  }`
                }
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-white/10 text-[10px] text-white/30">
        v1.3.0-dev
      </div>
    </aside>
  )
}
