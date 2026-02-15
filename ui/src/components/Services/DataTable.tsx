import type { ReactNode } from 'react'

interface Column<T> {
  key: string
  header: string
  render: (item: T) => ReactNode
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyFn: (item: T) => string
  onRowClick?: (item: T) => void
  emptyMessage?: string
}

export default function DataTable<T>({
  columns,
  data,
  keyFn,
  onRowClick,
  emptyMessage = 'No data',
}: DataTableProps<T>) {
  return (
    <div className="bg-white rounded-lg border border-cp-gray-200 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-cp-gray-200">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-left text-xs font-semibold text-cp-gray-500 uppercase tracking-wider ${col.className || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-cp-gray-400">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr
                key={keyFn(item)}
                onClick={() => onRowClick?.(item)}
                className={`border-b border-cp-gray-100 last:border-0 transition-colors ${
                  onRowClick ? 'cursor-pointer hover:bg-cp-gray-50' : ''
                }`}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 text-sm ${col.className || ''}`}>
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
