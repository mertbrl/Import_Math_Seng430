import axios from 'axios';
import api from './api';
import { buildApiUrl, buildBackendUrl } from '../config/apiConfig';

export async function setContext(payload) {
  const response = await api.post("/context", payload);
  return response.data;
}

export async function exploreData(payload) {
  const response = await api.post("/explore", payload);
  return response.data;
}

/**
 * Uploads a CSV to the FastAPI backend to compute EDA profile.
 * @param {File} file
 * @param {string[]} ignoredColumns Columns tagged as ID or Metadata to be excluded from correlations
 */
export const exploreDataset = async (file, ignoredColumns = [], sessionId = 'demo-session') => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('session_id', sessionId);

  // Append ignored columns as JSON list
  if (ignoredColumns.length > 0) {
    formData.append('ignored_columns', JSON.stringify(ignoredColumns));
  }

  const response = await axios.post(buildApiUrl('/explore'), formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 90000, // Render free instances can need time to wake before EDA starts
  });
  return response.data;
}

export async function checkBackendHealth(timeoutMs = 4000) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(buildBackendUrl('/healthz'), { method: 'GET', signal: controller.signal });
    return {
      reachable: response.ok,
      status: response.status,
    };
  } catch (error) {
    return {
      reachable: false,
      status: null,
      error,
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function preprocessData(payload) {
  const response = await api.post("/prepare", payload);
  return response.data;
}

export async function putMapping(sessionId, payload) {
  // The backend implicitly saves the mapping during validation
  const response = await api.post("/validate-mapping", { session_id: sessionId, ...payload });
  return response.data;
}

export async function validateMapping(sessionId) {
  const response = await api.post("/validate-mapping", { session_id: sessionId });
  return response.data;
}

export async function trainModel(payload) {
  const response = await api.post("/models/train/start", payload);
  return response.data;
}

export async function cancelTrainingTasks(payload) {
  const response = await api.post("/models/train/cancel", payload);
  return response.data;
}

export async function deleteSession(sessionId) {
  if (!sessionId) {
    return null;
  }

  try {
    const response = await api.delete(`/sessions/${sessionId}`);
    return response.data;
  } catch (error) {
    if (error?.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function evaluateModel(payload) {
  const response = await api.post("/evaluation", payload);
  return response.data;
}

export async function explainModel(payload) {
  const response = await api.post("/insights/explain/global", payload);
  return response.data;
}

export async function checkFairness(payload) {
  const response = await api.post("/insights/fairness", payload);
  return response.data;
}

export async function buildCertificate(payload) {
  const response = await api.post("/certificate/generate", payload);
  return response.data;
}

export async function getExplainabilityWorkbench(payload) {
  const response = await api.post("/insights/explain/workbench", payload);
  return response.data;
}

export async function simulateExplainability(payload) {
  const response = await api.post("/insights/explain/simulate", payload);
  return response.data;
}

export async function getModelCatalog() {
  const response = await api.get("/models");
  return response.data;
}

/**
 * Downloads the audit certificate as a PDF file.
 * Triggers an automatic browser download.
 */
export async function downloadCertificatePdf(payload) {
  const response = await api.post("/certificate/download-pdf", payload, {
    responseType: "arraybuffer",
  });
  const blob = new Blob([response.data], {
    type: "application/pdf",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const disposition = response.headers["content-disposition"] ?? "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  anchor.download = match ? match[1] : "audit_certificate.pdf";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
