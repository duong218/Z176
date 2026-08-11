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

// Lấy danh sách kỳ thi theo 1 trạng thái bất kỳ — dùng chung cho các nhu cầu lọc khác
// ngoài "chờ duyệt" / "chờ phát hành" phía trên.
export async function fetchExamsByStatus(status) {
  const res = await apiRequest(`/exams?status=${encodeURIComponent(status)}`, {
    headers: getAuthHeaders(),
  });
  return res.data;
}

// Lịch sử các đề xuất đã được Lãnh đạo xử lý xong: bị từ chối, đã đăng chính thức,
// hoặc đã bị lưu trữ (khi có kỳ thi khác được đăng đè lên). Gộp cả 3 trạng thái này
// lại thành 1 danh sách "Lịch sử duyệt kỳ thi", sắp xếp theo thời gian xử lý gần nhất.
// Route GET /api/exams hiện chỉ lọc theo đúng 1 status/lần gọi, nên gọi song song rồi
// merge ở phía client thay vì sửa API.
export async function fetchExamHistory() {
  const [rejected, published, archived] = await Promise.all([
    fetchExamsByStatus('rejected').catch(() => []),
    fetchExamsByStatus('published').catch(() => []),
    fetchExamsByStatus('archived').catch(() => []),
  ]);

  const all = [
    ...(Array.isArray(rejected) ? rejected : []),
    ...(Array.isArray(published) ? published : []),
    ...(Array.isArray(archived) ? archived : []),
  ];

  const getProcessedAt = (exam) =>
    new Date(exam.publishedAt || exam.approvedAt || exam.updatedAt || exam.createdAt || 0).getTime();

  return all.sort((a, b) => getProcessedAt(b) - getProcessedAt(a));
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