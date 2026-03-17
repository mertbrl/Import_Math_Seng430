/**
 * dataPrepAPI.ts
 * Single-responsibility: All Data Preparation API calls for Step 3.
 * Components and Zustand stores import from here; never hit fetch() directly.
 */

const BASE_URL = (import.meta as any).env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';

// ── Types ───────────────────────────────────────────────────────────────────

export interface BasicCleaningStats {
  session_id: string;
  duplicates_count: number;
  zero_variance_columns: string[];
  excluded_columns_applied: number;
}

export interface TypeMismatchColumn {
  column: string;
  current_type: string;
  suggested_type: string;
  coerce_rate: number;
}

export interface TypeMismatchStats {
  session_id: string;
  mismatched_columns: TypeMismatchColumn[];
  total_mismatches: number;
}

export interface MissingColumnStat {
  column: string;
  missing_count: number;
  missing_percentage: number;
  type: string;
}

export interface OutlierColumnStat {
  column: string;
  type: string;
  distribution: string;
  outlier_count: number;
  outlier_percentage: number;
  recommendation: string;
}

export interface FeatureImportanceStat {
  feature: string;
  score: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Read the backend error body and throw a descriptive Error. */
async function throwDetailedError(res: Response, label: string): Promise<never> {
  let detail = `HTTP ${res.status}`;
  try {
    const body = await res.json();
    detail = body.error || body.detail || JSON.stringify(body);
  } catch {
    // body wasn't JSON — fall back to status text
    detail += ` ${res.statusText}`;
  }
  console.error(`[${label}] Backend error:`, detail);
  throw new Error(`${label} failed: ${detail}`);
}

// ── API Calls ────────────────────────────────────────────────────────────────

export async function fetchBasicCleaningStats(
  sessionId: string,
  excludedColumns: string[]
): Promise<BasicCleaningStats> {
  const res = await fetch(`${BASE_URL}/basic-cleaning-stats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, excluded_columns: excludedColumns }),
  });
  if (!res.ok) await throwDetailedError(res, 'basic-cleaning-stats');
  return res.json();
}

export async function fetchTypeMismatchStats(
  sessionId: string,
  excludedColumns: string[]
): Promise<TypeMismatchStats> {
  const res = await fetch(`${BASE_URL}/type-mismatch-stats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, excluded_columns: excludedColumns }),
  });
  if (!res.ok) await throwDetailedError(res, 'type-mismatch-stats');
  return res.json();
}

export async function fetchMissingStats(
  sessionId: string,
  excludedColumns: string[]
): Promise<MissingColumnStat[]> {
  const res = await fetch(`${BASE_URL}/missing-stats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, excluded_columns: excludedColumns }),
  });
  if (!res.ok) await throwDetailedError(res, 'missing-stats');
  return res.json();
}

export async function fetchOutlierStats(
  sessionId: string,
  excludedColumns: string[]
): Promise<OutlierColumnStat[]> {
  const res = await fetch(`${BASE_URL}/outliers-stats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, excluded_columns: excludedColumns }),
  });
  if (!res.ok) await throwDetailedError(res, 'outliers-stats');
  return res.json();
}

export async function fetchFeatureImportances(
  sessionId: string,
  excludedColumns: string[],
  targetColumn: string
): Promise<FeatureImportanceStat[]> {
  const res = await fetch(`${BASE_URL}/feature-importance-stats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, excluded_columns: excludedColumns, target_column: targetColumn }),
  });
  if (!res.ok) await throwDetailedError(res, 'feature-importance-stats');
  return res.json();
}

export async function downloadPreprocessedCSV(
  sessionId: string,
  pipeline: any[],
  targetColumn: string,
  excludedColumns: string[]
): Promise<void> {
  const res = await fetch(`${BASE_URL}/download-preprocessed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      pipeline,
      target_column: targetColumn,
      excluded_columns: excludedColumns,
    }),
  });
  if (!res.ok) await throwDetailedError(res, 'download-preprocessed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'preprocessed_data.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

