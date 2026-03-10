import { useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import type { ColumnDef } from '../types'

interface Props {
  columns: ColumnDef[]
  rows: Record<string, unknown>[]
  truncated: boolean
}

export default function ResultsGrid({ columns, rows, truncated }: Props) {
  const colDefs = useMemo(
    () =>
      columns.map((c) => ({
        field: c.field,
        headerName: c.headerName,
        sortable: true,
        filter: true,
        resizable: true,
        minWidth: 100,
      })),
    [columns],
  )

  if (rows.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic py-4 text-center">No rows returned.</p>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {truncated && (
        <p className="text-xs text-amber-500 px-1">
          Results truncated to 1,000 rows. Refine your query to see more.
        </p>
      )}
      <div className="ag-theme-alpine w-full" style={{ height: 340 }}>
        <AgGridReact
          columnDefs={colDefs}
          rowData={rows}
          defaultColDef={{ flex: 1, minWidth: 80, resizable: true }}
          pagination
          paginationPageSize={20}
          suppressMovableColumns
        />
      </div>
      <p className="text-xs text-gray-400 text-right pr-1">
        {rows.length.toLocaleString()} row{rows.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
