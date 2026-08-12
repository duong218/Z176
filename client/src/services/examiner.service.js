import { apiRequest } from './api';
import { getAuthHeaders } from './auth.service';

export async function fetchQuestions(params = {}) {
  const query = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== '') {
      query.append(key, val);
    }
  }
  const queryString = query.toString();
  const path = `/questions${queryString ? '?' + queryString : ''}`;
  const res = await apiRequest(path, {
    headers: getAuthHeaders(),
  });
  return res.data; // { items, pagination }
}

export async function fetchQuestionById(id) {
  const res = await apiRequest(`/questions/${id}`, {
    headers: getAuthHeaders(),
  });
  return res.data;
}

export async function createQuestion(payload) {
  const res = await apiRequest('/questions', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateQuestion(id, payload) {
  const res = await apiRequest(`/questions/${id}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function deleteQuestion(id) {
  const res = await apiRequest(`/questions/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return res.data;
}

export async function importQuestions(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await apiRequest('/questions/import', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });
  return res.data;
}

export async function bulkDeleteQuestions({ ids, filters }) {
  const res = await apiRequest('/questions/bulk-delete', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ ids, filters }),
  });
  return res.data;
}

export async function fetchTopics() {
  const res = await apiRequest('/topics', {
    headers: getAuthHeaders(),
  });
  return res.data;
}

export async function createTopic(payload) {
  const res = await apiRequest('/topics', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateTopic(id, payload) {
  const res = await apiRequest(`/topics/${id}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function deleteTopic(id) {
  const res = await apiRequest(`/topics/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return res.data;
}

export async function fetchDepartments() {
  const res = await apiRequest('/departments', {
    headers: getAuthHeaders(),
  });
  return res.data;
}

export async function createDepartment(payload) {
  const res = await apiRequest('/departments', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateDepartment(id, payload) {
  const res = await apiRequest(`/departments/${id}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function deleteDepartment(id) {
  const res = await apiRequest(`/departments/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return res.data;
}

export async function fetchQuestionStatsByTopic(topicId) {
  const res = await apiRequest(`/questions/stats/by-topic/${topicId}`, {
    headers: getAuthHeaders(),
  });
  return res.data;
}

// === EXAM PROPOSALS ===

export async function createExamProposal(payload) {
  const res = await apiRequest('/exams', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function submitForReview(examId) {
  const res = await apiRequest(`/exams/${examId}/submit`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return res.data;
}

export async function fetchMyExamProposals() {
  const res = await apiRequest('/exams', {
    headers: getAuthHeaders(),
  });
  return res.data;
}