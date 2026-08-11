import { apiRequest } from './api.js';
import { getAuthHeaders } from './auth.service.js';

/**
 * Lấy đề thi hiện tại của thí sinh (câu hỏi + đáp án, đáp án đúng đã bị ẩn ở
 * backend) cùng trạng thái lượt thi (đang dở / đã dùng hết).
 */
export async function fetchMyExam() {
  const result = await apiRequest('/exam-attempts/my-exam', {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  return result.data;
}

/**
 * Bắt đầu lượt thi chính thức. Nếu đang có lượt dở (in_progress) thì backend
 * tự trả về đúng lượt đó (resume) thay vì tạo lượt mới.
 */
export async function startExamAttempt() {
  const result = await apiRequest('/exam-attempts/start', {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return result.data;
}

/**
 * Nộp bài thi. answers: [{ questionId, selectedAnswerIds: string[] }]
 */
export async function submitExamAttempt(attemptId, answers) {
  const result = await apiRequest(`/exam-attempts/${attemptId}/submit`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ answers }),
  });
  return result.data;
}