export const MOCK_ROLES = [
  { _id: 'role-admin', code: 'admin', name: 'Quản trị viên' },
  { _id: 'role-examiner', code: 'examiner', name: 'Người ra đề' },
  { _id: 'role-candidate', code: 'candidate', name: 'Người dự thi' },
];

export const MOCK_USERS = [
  { _id: 'u1', username: 'admin', roleId: 'role-admin', isActive: true },
  { _id: 'u2', username: 'nguyenvana', roleId: 'role-examiner', isActive: true },
  { _id: 'u3', username: 'tranthib', roleId: 'role-candidate', isActive: true },
];

export const MOCK_AUDIT_LOGS = [
  {
    _id: 'log1',
    createdAt: new Date().toISOString(),
    actorUsername: 'nguyenvana',
    action: 'CREATE_QUESTION',
    resourceType: 'Question',
    details: 'Tạo câu hỏi mới trong chủ đề "Vệ sinh an toàn lao động"',
  },
  {
    _id: 'log2',
    createdAt: new Date(Date.now() - 3600_000).toISOString(),
    actorUsername: 'admin',
    action: 'UPDATE_ROLE',
    resourceType: 'User',
    details: 'Đổi role tài khoản tranthib sang examiner',
  },
];

export const MOCK_OVERVIEW_STATS = {
  totalUsers: 3,
  usersByRole: { admin: 1, examiner: 1, candidate: 1 },
  activeExams: 0,
};