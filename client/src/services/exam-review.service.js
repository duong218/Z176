import { apiRequest } from './api';
import { getAuthHeaders } from './auth.service';

export async function fetchPendingExams() {
  const res = await apiRequest('/exams?status=pending_review', {
    headers: getAuthHeaders(),
  });
  return res.data;
}

export async function fetchApprovedExams() {
  const res = await apiRequest('/exams?status=approved', {
    headers: getAuthHeaders(),
  });
  return res.data;
}

export async function approveExam(id, payload) {
  const res = await apiRequest(`/exams/${id}/approve`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function rejectExam(id, reason) {
  const res = await apiRequest(`/exams/${id}/reject`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ rejectionReason: reason }),
  });
  return res.data;
}

export async function publishExam(id) {
  const res = await apiRequest(`/exams/${id}/publish`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return res.data;
}

// Public API
export async function fetchActiveExam() {
  try {
    const res = await apiRequest('/exams/active');
    return res.data;
  } catch (error) {
    console.error('Failed to fetch active exam:', error);
    return null;
  }
}
