import React, { useId } from 'react'
import { Checkbox } from '../checkbox/Checkbox'
import { TableSkeleton } from '../table-skeleton/TableSkeleton'

export type ColumnAlign = 'left' | 'center' | 'right'

export interface TableColumn<T> {
  key: string
  header: React.ReactNode
  accessor?: keyof T
  render?: (value: unknown, record: T, index: number) => React.ReactNode
  align?: ColumnAlign
  width?: string | number
  className?: string
  headerClassName?: string
}

export interface TableRowSelection<T> {
  selectedRowKeys: (string | number)[]
  onChange: (selectedRowKeys: (string | number)[], selectedRows: T[]) => void
  getRowKey?: (record: T, index: number) => string | number
  disabled?: (record: T) => boolean
}

export interface TableProps<T> {
  columns: TableColumn<T>[]
  data: T[]
  rowKey?: keyof T | ((record: T, index: number) => string | number)
  loading?: boolean
  loadingRows?: number
  emptyState?: React.ReactNode
  onRowClick?: (record: T, index: number) => void
  hoverable?: boolean
  striped?: boolean
  rowSelection?: TableRowSelection<T>
  className?: string
  caption?: string
}

const alignClasses: Record<ColumnAlign, string> = {
  left: 'text-left justify-start',
  center: 'text-center justify-center',
  right: 'text-right justify-end',
}

export function Table<T extends Record<string, unknown>>({
  columns,
  data,
  rowKey,
  loading = false,
  loadingRows = 5,
  emptyState,
  onRowClick,
  hoverable = true,
  striped = false,
  rowSelection,
  className = '',
  caption,
}: TableProps<T>): React.ReactElement {
  const fallbackId = useId()

  const getRecordKey = (record: T, index: number): string | number => {
    if (typeof rowKey === 'function') {
      return rowKey(record, index)
    }
    if (typeof rowKey === 'string' && record[rowKey] !== undefined) {
      return String(record[rowKey])
    }
    if ('id' in record && record.id !== undefined) {
      return String(record.id)
    }
    if ('key' in record && record.key !== undefined) {
      return String(record.key)
    }
    return `${fallbackId}-${index}`
  }

  // Row selection logic
  const selectableRows = data.filter((record) =>
    rowSelection?.disabled ? !rowSelection.disabled(record) : true
  )
  const selectableKeys = selectableRows.map((record, index) =>
    rowSelection?.getRowKey ? rowSelection.getRowKey(record, index) : getRecordKey(record, index)
  )

  const selectedCount = selectableKeys.filter((key) =>
    rowSelection?.selectedRowKeys.includes(key)
  ).length

  const isAllSelected = selectableKeys.length > 0 && selectedCount === selectableKeys.length
  const isIndeterminate = selectedCount > 0 && selectedCount < selectableKeys.length

  const handleSelectAll = (checked: boolean) => {
    if (!rowSelection) return
    if (checked) {
      // Merge newly selected keys with existing keys
      const newKeys = Array.from(new Set([...rowSelection.selectedRowKeys, ...selectableKeys]))
      const newRows = data.filter((r, i) =>
        newKeys.includes(rowSelection.getRowKey ? rowSelection.getRowKey(r, i) : getRecordKey(r, i))
      )
      rowSelection.onChange(newKeys, newRows)
    } else {
      // Deselect all selectable keys
      const newKeys = rowSelection.selectedRowKeys.filter((k) => !selectableKeys.includes(k))
      const newRows = data.filter((r, i) =>
        newKeys.includes(rowSelection.getRowKey ? rowSelection.getRowKey(r, i) : getRecordKey(r, i))
      )
      rowSelection.onChange(newKeys, newRows)
    }
  }

  const handleRowSelect = (recordKey: string | number, checked: boolean) => {
    if (!rowSelection) return
    let newKeys: (string | number)[]
    if (checked) {
      newKeys = [...rowSelection.selectedRowKeys, recordKey]
    } else {
      newKeys = rowSelection.selectedRowKeys.filter((k) => k !== recordKey)
    }
    const newRows = data.filter((r, i) =>
      newKeys.includes(rowSelection.getRowKey ? rowSelection.getRowKey(r, i) : getRecordKey(r, i))
    )
    rowSelection.onChange(newKeys, newRows)
  }

  // If loading, render TableSkeleton with identical column count
  if (loading) {
    const totalCols = columns.length + (rowSelection ? 1 : 0)
    return <TableSkeleton rows={loadingRows} columns={totalCols} className={className} />
  }

  return (
    <div
      className={`w-full overflow-hidden rounded-2xl border border-border bg-white shadow-card ${className}`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="bg-[#F9FAFB] border-b border-border">
            <tr>
              {/* Row selection header cell */}
              {rowSelection && (
                <th scope="col" className="w-12 py-3.5 px-4 text-center">
                  <div className="flex items-center justify-center">
                    <Checkbox
                      checked={isAllSelected}
                      indeterminate={isIndeterminate}
                      aria-label="Select all rows"
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </div>
                </th>
              )}

              {/* Data column headers */}
              {columns.map((column) => {
                const align = column.align || 'left'
                return (
                  <th
                    key={column.key}
                    scope="col"
                    style={column.width ? { width: column.width } : undefined}
                    className={`py-3.5 px-4 text-xs font-semibold text-[#6B7280] uppercase tracking-wider select-none ${
                      alignClasses[align]
                    } ${column.headerClassName || ''}`}
                  >
                    <div className={`flex items-center gap-1.5 ${alignClasses[align]}`}>
                      {column.header}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-border">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (rowSelection ? 1 : 0)}
                  className="py-12 px-6 text-center"
                >
                  {emptyState || (
                    <div className="flex flex-col items-center justify-center space-y-3 py-6">
                      <div className="p-3 bg-brand-soft/30 text-brand-primary rounded-2xl">
                        <svg
                          className="w-8 h-8"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                          />
                        </svg>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-[#111827]">No records found</p>
                        <p className="text-xs text-[#6B7280]">
                          There are currently no items matching your criteria.
                        </p>
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              data.map((record, index) => {
                const recKey = rowSelection?.getRowKey
                  ? rowSelection.getRowKey(record, index)
                  : getRecordKey(record, index)

                const isSelected = Boolean(rowSelection?.selectedRowKeys.includes(recKey))
                const isSelectionDisabled = Boolean(rowSelection?.disabled?.(record))

                const isClickable = Boolean(onRowClick)

                return (
                  <tr
                    key={recKey}
                    onClick={() => onRowClick?.(record, index)}
                    className={`transition-colors ${
                      isSelected
                        ? 'bg-brand-soft/20'
                        : striped && index % 2 === 1
                        ? 'bg-[#F9FAFB]/50'
                        : 'bg-white'
                    } ${hoverable ? 'hover:bg-[#F9FAFB]/80' : ''} ${
                      isClickable ? 'cursor-pointer' : ''
                    }`}
                  >
                    {/* Row selection cell */}
                    {rowSelection && (
                      <td
                        className="py-4 px-4 text-center w-12"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={isSelected}
                            disabled={isSelectionDisabled}
                            aria-label={`Select row ${index + 1}`}
                            onChange={(e) => handleRowSelect(recKey, e.target.checked)}
                          />
                        </div>
                      </td>
                    )}

                    {/* Data column cells */}
                    {columns.map((column) => {
                      const align = column.align || 'left'
                      const cellValue = column.accessor ? record[column.accessor] : undefined

                      return (
                        <td
                          key={`cell-${recKey}-${column.key}`}
                          style={column.width ? { width: column.width } : undefined}
                          className={`py-4 px-4 text-xs md:text-sm text-[#111827] leading-relaxed ${
                            alignClasses[align]
                          } ${column.className || ''}`}
                        >
                          {column.render
                            ? column.render(cellValue, record, index)
                            : (cellValue as React.ReactNode) ?? '\u2014'}
                        </td>
                      )
                    })}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

Table.displayName = 'Table'

export default Table
