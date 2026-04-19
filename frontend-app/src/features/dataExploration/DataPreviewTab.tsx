import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Table } from 'lucide-react';
import type { ColumnStats, PreviewData } from './mockEDAData';

interface DataPreviewTabProps {
  preview: PreviewData;
  columns?: ColumnStats[];
  page?: number;
  onPageChange?: (page: number) => void;
  compact?: boolean;
  targetColumn?: string;
}

const PAGE_SIZE = 10;

function inferType(header: string, preview: PreviewData, columns?: ColumnStats[]) {
  const matched = columns?.find((column) => column.name === header);
  if (matched?.type === 'Numeric') return { label: '# numeric', tone: 'bg-sky-100 text-sky-800' };
  if (matched?.type === 'Categorical') return { label: 'T categorical', tone: 'bg-emerald-100 text-emerald-800' };
  if (matched?.type === 'Boolean') return { label: 'boolean', tone: 'bg-amber-100 text-amber-800' };

  const sample = preview.rows.find((row) => row[header] !== null && row[header] !== undefined)?.[header];
  if (typeof sample === 'number') return { label: '# numeric', tone: 'bg-sky-100 text-sky-800' };
  if (typeof sample === 'boolean') return { label: 'boolean', tone: 'bg-amber-100 text-amber-800' };
  return { label: 'T categorical', tone: 'bg-emerald-100 text-emerald-800' };
}

const DataPreviewTab: React.FC<DataPreviewTabProps> = ({
  preview,
  columns,
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

  const { headers = [], rows = [] } = preview ?? {};
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages - 1) {
      setPage(Math.max(0, totalPages - 1));
    }
  }, [page, totalPages]);

  const typeBadges = useMemo(
    () =>
      headers.reduce<Record<string, { label: string; tone: string }>>((acc, header) => {
        acc[header] = inferType(header, preview, columns);
        return acc;
      }, {}),
    [columns, headers, preview],
  );

  if (!headers.length) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-[20px] border border-dashed border-[var(--border)] bg-[var(--surface2)] text-center text-[var(--text3)]">
        <Table size={34} />
        <div>
          <p className="text-sm font-semibold text-[var(--text2)]">No preview data available</p>
          <p className="mt-1 text-sm">Upload a dataset to inspect the first rows.</p>
        </div>
      </div>
    );
  }

  const start = page * PAGE_SIZE;
  const pageRows = rows.slice(start, start + PAGE_SIZE);

  return (
    <div className={compact ? 'space-y-4' : 'space-y-5'}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {!compact && (
            <div>
              <p className="ha-section-label">Data Preview</p>
              <h3 className="mt-2 font-[var(--font-display)] text-[24px] font-bold tracking-[-0.04em] text-[var(--text)]">
                Uploaded table snapshot
              </h3>
            </div>
          )}
          <span className="ha-pill">{rows.length} rows</span>
          <span className="ha-pill">{headers.length} columns</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-[var(--text2)]">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className={page === 0 ? 'ha-button-locked inline-flex h-10 w-10 items-center justify-center p-0' : 'ha-button-secondary inline-flex h-10 w-10 items-center justify-center p-0'}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page === totalPages - 1}
              className={page === totalPages - 1 ? 'ha-button-locked inline-flex h-10 w-10 items-center justify-center p-0' : 'ha-button-secondary inline-flex h-10 w-10 items-center justify-center p-0'}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="ha-table-shell ha-scrollbar-thin overflow-x-auto"> 
        <table className="ha-table min-w-max"> 
          <thead>
            <tr>
              <th className="ha-sticky-index min-w-[68px] text-left text-[10px] font-bold uppercase tracking-[0.18em] text-white/72">
                #
              </th>
              {headers.map((header) => (
                <th key={header} className="min-w-[180px] text-left align-top">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-[0.16em]">
                        {header}
                      </span>
                      {targetColumn && targetColumn === header ? (
                        <span className="ha-badge bg-amber-200 text-amber-950">target</span>
                      ) : null}
                    </div>
                    <span className={`ha-badge w-fit ${typeBadges[header].tone}`}>
                      {typeBadges[header].label}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, rowIndex) => {
              const globalIndex = start + rowIndex;
              return (
                <tr key={globalIndex}>
                  <td className="ha-sticky-index bg-white/72 text-[11px] font-semibold">
                    {globalIndex + 1}
                  </td>
                  {headers.map((header) => {
                    const value = row[header];
                    const isMissing = value === null || value === undefined || value === '';

                    return (
                      <td
                        key={`${globalIndex}-${header}`}
                        className={`${
                          typeof value === 'number' ? 'text-right text-sky-800' : 'text-[var(--text)]'
                        } ${isMissing ? 'italic text-[var(--text3)]' : ''}`}
                      >
                        {isMissing ? '—' : String(value)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataPreviewTab;
