import { useState, useEffect } from 'react';
import {
  UserCircle2,
  Building2,
  BadgeCheck,
  Award,
  XCircle,
  History,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { fetchMyResults } from '../../services/report.service';

const formatDateTime = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const CandidateDashboard = ({ currentUser }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [results, setResults] = useState([]);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetchMyResults()
      .then((data) => {
        if (cancelled) return;
        setEmployee(data?.employee ?? null);
        setResults(Array.isArray(data?.results) ? data.results : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Không thể tải dữ liệu kết quả thi.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const totalAttempts = results.length;
  const bestResult = results.reduce((best, r) => {
    if (!best) return r;
    return r.score > best.score ? r : best;
  }, null);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 mt-16 min-h-screen">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-[#0F172A] mb-2 flex items-center gap-3">
          <UserCircle2 className="w-8 h-8 text-[#008BC5]" />
          DASHBOARD CỦA TÔI
        </h1>
        <p className="text-slate-500">Thông tin cá nhân và lịch sử kết quả thi của bạn.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Đang tải dữ liệu...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : !employee ? (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>
            Tài khoản của bạn chưa được liên kết với hồ sơ nhân viên nào. Vui lòng liên hệ quản trị viên để được hỗ trợ.
          </span>
        </div>
      ) : (
        <>
          {/* Thông tin cá nhân */}
          <div className="bg-white rounded-xl shadow-z176 border border-slate-200 p-6 mb-6">
            <h2 className="text-lg font-bold text-[#0F172A] mb-4 flex items-center gap-2">
              <UserCircle2 className="w-5 h-5 text-[#008BC5]" />
              Thông tin cá nhân
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <UserCircle2 className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs text-slate-500">Họ và tên</div>
                  <div className="font-semibold text-[#0F172A]">{employee.fullname}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <BadgeCheck className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs text-slate-500">Mã nhân viên</div>
                  <div className="font-semibold text-[#0F172A] font-mono">
                    {employee.employeeCode || '—'}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Building2 className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs text-slate-500">Phòng ban</div>
                  <div className="font-semibold text-[#0F172A]">
                    {employee.departmentName || '—'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tổng quan nhanh */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-z176 border border-slate-200 p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-lg bg-[#008BC5]/10 flex items-center justify-center shrink-0">
                <History className="w-6 h-6 text-[#008BC5]" />
              </div>
              <div>
                <div className="text-xs text-slate-500">Số lần đã thi</div>
                <div className="text-xl font-bold text-[#0F172A]">{totalAttempts}</div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-z176 border border-slate-200 p-5 flex items-center gap-4">
              <div
                className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${
                  bestResult?.passed ? 'bg-[#22C55E]/10' : 'bg-slate-100'
                }`}
              >
                <Award className={`w-6 h-6 ${bestResult?.passed ? 'text-[#22C55E]' : 'text-slate-400'}`} />
              </div>
              <div>
                <div className="text-xs text-slate-500">Điểm cao nhất</div>
                <div className="text-xl font-bold text-[#0F172A]">
                  {bestResult ? `${bestResult.score} điểm` : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Lịch sử kết quả */}
          <div className="bg-white rounded-xl shadow-z176 border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                <History className="w-5 h-5 text-[#008BC5]" />
                Lịch sử kết quả thi
              </h2>
            </div>

            {results.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                Bạn chưa có lượt thi nào được ghi nhận.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                      <th className="px-4 py-3 text-left font-semibold">Bài thi</th>
                      <th className="px-4 py-3 text-left font-semibold">Thời gian nộp</th>
                      <th className="px-4 py-3 text-center font-semibold">Điểm</th>
                      <th className="px-4 py-3 text-center font-semibold">Số câu đúng</th>
                      <th className="px-4 py-3 text-center font-semibold">Kết quả</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {results.map((r) => (
                      <tr key={r._id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-[#0F172A]">{r.examTitle}</td>
                        <td className="px-4 py-3 text-slate-500">{formatDateTime(r.submittedAt)}</td>
                        <td className="px-4 py-3 text-center font-bold text-[#0F172A]">{r.score}</td>
                        <td className="px-4 py-3 text-center text-slate-500">
                          {r.correctCount}/{r.totalQuestions}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {r.passed ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#22C55E]/10 text-[#22C55E] font-semibold text-xs">
                              <Award className="w-3.5 h-3.5" /> Đạt
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-600 font-semibold text-xs">
                              <XCircle className="w-3.5 h-3.5" /> Chưa đạt
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};