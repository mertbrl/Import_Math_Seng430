import React, { useEffect, useState } from 'react';
import { Table, ChevronLeft, ChevronRight } from 'lucide-react';
import type { PreviewData } from './mockEDAData';

interface DataPreviewTabProps {
  preview: PreviewData;
  page?: number;
  onPageChange?: (page: number) => void;
  compact?: boolean;
  targetColumn?: string;
}

const PAGE_SIZE = 10;

const DataPreviewTab: React.FC<DataPreviewTabProps> = ({
  preview,
  page: controlledPage,
  onPageChange,
  compact = false,
  targetColumn,
}) => {
  const [internalPage, setInternalPage] = useState(0);
  const page = controlledPage ?? internalPage;

  const setPage = (nextPage: number) => {
    if (controlledPage === undefined) {
      setInternalPage(nextPage);
    }
    onPageChange?.(nextPage);
  };

  if (!preview || !preview.headers || preview.headers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Table size={40} className="mb-3 opacity-30" />
        <p className="text-sm font-medium">No preview data available</p>
        <p className="text-xs mt-1">Upload a dataset to see the first rows</p>
      </div>
    );
  }

  const { headers, rows } = preview;
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages - 1) {
      setPage(Math.max(0, totalPages - 1));
    }
  }, [page, totalPages]);

  const start = page * PAGE_SIZE;
  const pageRows = rows.slice(start, start + PAGE_SIZE);

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Table size={17} className="text-indigo-600" />
          {!compact && (
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Data Preview
            </h3>
          )}
          <span className="ml-2 text-[11px] bg-slate-100 text-slate-500 rounded-full px-2.5 py-0.5 font-semibold">
            {rows.length} rows · {headers.length} columns
          </span>
        </div>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 transition"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="font-medium">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page === totalPages - 1}
              className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 transition"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
        <table className="w-full text-xs font-mono">
          {/* Column Headers */}
          <thead>
            <tr className="bg-slate-800 text-slate-100">
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 border-r border-slate-700 w-10 sticky left-0 bg-slate-800">
                #
              </th>
              {headers.map((h) => (
                <th
                  key={h}
                  className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider whitespace-nowrap border-r border-slate-700 last:border-0"
                >
                  <span className="inline-flex items-center gap-1">
                    <span>{h}</span>
                    {targetColumn && h === targetColumn && (
                      <span
                        className="text-[11px] leading-none text-amber-300"
                        title="Target column"
                      >
                        *
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, rowIdx) => {
              const globalIdx = start + rowIdx;
              return (
                <tr
                  key={globalIdx}
                  className={`border-b border-slate-100 transition-colors ${
                    rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                  } hover:bg-indigo-50/40`}
                >
                  {/* Row number */}
                  <td className="px-3 py-2 text-slate-400 text-[10px] font-semibold border-r border-slate-100 sticky left-0 bg-inherit">
                    {globalIdx + 1}
                  </td>
                  {headers.map((h) => {
                    const val = row[h];
                    const isNull = val === null || val === undefined;
                    return (
                      <td
                        key={h}
                        className={`px-3 py-2 whitespace-nowrap border-r border-slate-100 last:border-0 ${
                          isNull
                            ? 'text-slate-300 italic'
                            : typeof val === 'number'
                            ? 'text-indigo-700 text-right'
                            : 'text-slate-700'
                        }`}
                      >
                        {isNull ? '—' : String(val)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      {!compact && (
        <div className="flex items-center gap-5 text-[11px] text-slate-500 px-1">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-indigo-100 border border-indigo-200" />
            Numeric values
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-slate-200 border border-slate-300" />
            Text values
          </span>
          <span className="flex items-center gap-1.5 text-slate-300 italic">
            — Missing / null
          </span>
        </div>
      )}
    </div>
  );
};

export default DataPreviewTab;
