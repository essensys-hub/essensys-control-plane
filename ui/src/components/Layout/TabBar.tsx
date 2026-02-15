interface Tab {
  id: string
  label: string
}

interface TabBarProps {
  tabs: Tab[]
  active: string
  onChange: (id: string) => void
}

export default function TabBar({ tabs, active, onChange }: TabBarProps) {
  return (
    <div className="flex gap-1 border-b border-cp-gray-200 mb-6">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            active === tab.id
              ? 'border-cp-blue text-cp-blue'
              : 'border-transparent text-cp-gray-500 hover:text-cp-gray-700 hover:border-cp-gray-300'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
