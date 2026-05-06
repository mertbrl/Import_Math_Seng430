const DEFAULT_API_BASE_URL = 'https://yusuf06p-import-math-backend.hf.space/api/v1';
const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim();

export const API_BASE_URL = (configuredApiBaseUrl || DEFAULT_API_BASE_URL).replace(/\/+$/, '');

const inferredBackendUrl = API_BASE_URL.endsWith('/api/v1')
  ? API_BASE_URL.slice(0, -'/api/v1'.length)
  : API_BASE_URL;

export const BACKEND_URL_HINT = inferredBackendUrl || API_BASE_URL;

export function buildApiUrl(path = '') {
  if (!path) {
    return API_BASE_URL;
  }

  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function buildBackendUrl(path = '') {
  if (!path) {
    return BACKEND_URL_HINT;
  }

  return `${BACKEND_URL_HINT}${path.startsWith('/') ? path : `/${path}`}`;
}
