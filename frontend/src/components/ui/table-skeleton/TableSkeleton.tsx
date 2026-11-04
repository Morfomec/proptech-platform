import React from 'react'

export interface TableSkeletonProps {
  rows?: number
  columns?: number
  showHeader?: boolean
  className?: string
  columnWidths?: (string | number)[]
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  rows = 5,
  columns = 4,
  showHeader = true,
  className = '',
  columnWidths,
}) => {
  // Preset varied widths to simulate realistic data columns
  const cellWidths = ['w-3/4', 'w-1/2', 'w-2/3', 'w-5/6', 'w-4/5']

  return (
    <div
      role="status"
      aria-label="Loading table data"
      className={`w-full overflow-hidden rounded-2xl border border-border bg-white shadow-card ${className}`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          {showHeader && (
            <thead className="bg-[#F9FAFB] border-b border-border">
              <tr>
                {Array.from({ length: columns }).map((_, colIdx) => (
                  <th
                    key={`header-col-${colIdx}`}
                    style={columnWidths?.[colIdx] ? { width: columnWidths[colIdx] } : undefined}
                    className="py-3.5 px-4 text-xs font-semibold text-[#6B7280] uppercase tracking-wider"
                  >
                    <div className="h-4 bg-[#E5E7EB] rounded-md animate-pulse motion-reduce:animate-none w-24" />
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-border">
            {Array.from({ length: rows }).map((_, rowIdx) => (
              <tr key={`row-${rowIdx}`} className="bg-white">
                {Array.from({ length: columns }).map((_, colIdx) => {
                  const widthClass = cellWidths[(rowIdx + colIdx) % cellWidths.length]
                  return (
                    <td
                      key={`cell-${rowIdx}-${colIdx}`}
                      style={columnWidths?.[colIdx] ? { width: columnWidths[colIdx] } : undefined}
                      className="py-4 px-4"
                    >
                      <div
                        className={`h-4 bg-[#F3F4F6] rounded-md animate-pulse motion-reduce:animate-none ${widthClass}`}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

TableSkeleton.displayName = 'TableSkeleton'

export default TableSkeleton
