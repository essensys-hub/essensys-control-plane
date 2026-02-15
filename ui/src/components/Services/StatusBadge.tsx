interface StatusBadgeProps {
  status: string
  size?: 'sm' | 'md'
}

const statusStyles: Record<string, string> = {
  running: 'bg-cp-green-light text-green-800',
  'up to date': 'bg-cp-green-light text-green-800',
  stopped: 'bg-cp-red-light text-red-800',
  error: 'bg-cp-red-light text-red-800',
  disconnected: 'bg-cp-red-light text-red-800',
  restarting: 'bg-cp-orange-light text-orange-800',
  'update available': 'bg-cp-blue-light text-blue-800',
  created: 'bg-cp-gray-200 text-cp-gray-700',
  unknown: 'bg-cp-gray-200 text-cp-gray-700',
  connected: 'bg-cp-green-light text-green-800',
}

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const key = status.toLowerCase()
  const style = statusStyles[key] || statusStyles.unknown

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium capitalize ${style} ${
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      }`}
    >
      {status}
    </span>
  )
}
