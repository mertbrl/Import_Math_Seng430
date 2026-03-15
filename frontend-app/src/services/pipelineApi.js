import axios from 'axios';
import api from './api';

const BACKEND_URL = 'http://localhost:8000/api/v1';

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
export const exploreDataset = async (file, ignoredColumns = []) => {
  const formData = new FormData();
  formData.append('file', file);

  // Append ignored columns as JSON list
  if (ignoredColumns.length > 0) {
    formData.append('ignored_columns', JSON.stringify(ignoredColumns));
  }

  const response = await axios.post(`${BACKEND_URL}/explore`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 30000, // EDA can take longer on large files
  });
  return response.data;
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

export async function getModelCatalog() {
  const response = await api.get("/models");
  return response.data;
}
