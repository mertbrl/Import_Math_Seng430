import api from "./api";

export async function setContext(payload) {
  const response = await api.post("/context", payload);
  return response.data;
}

export async function exploreData(payload) {
  const response = await api.post("/data/explore", payload);
  return response.data;
}

export async function preprocessData(payload) {
  const response = await api.post("/preprocess", payload);
  return response.data;
}

export async function putMapping(sessionId, payload) {
  const response = await api.put(`/sessions/${sessionId}/mapping`, payload);
  return response.data;
}

export async function validateMapping(sessionId) {
  const response = await api.post(`/sessions/${sessionId}/mapping/validate`);
  return response.data;
}

export async function trainModel(payload) {
  const response = await api.post("/train", payload);
  return response.data;
}

export async function evaluateModel(payload) {
  const response = await api.post("/evaluation", payload);
  return response.data;
}

export async function explainModel(payload) {
  const response = await api.post("/explainability", payload);
  return response.data;
}

export async function checkFairness(payload) {
  const response = await api.post("/fairness", payload);
  return response.data;
}

export async function buildCertificate(payload) {
  const response = await api.post("/certificate", payload);
  return response.data;
}

export async function getModelCatalog() {
  const response = await api.get("/model/catalog");
  return response.data;
}
