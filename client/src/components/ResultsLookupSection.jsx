import { useState } from 'react';
import { Award, Search, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { SAMPLE_RESULTS, Z176_COMPANY_INFO } from '../data';

export const ResultsLookupSection = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('Tất cả');
  const [resultsList] = useState(SAMPLE_RESULTS);

  const filteredResults = resultsList.filter((res) => {
    const matchesSearch =
      res.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      res.employeeId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = selectedDept === 'Tất cả' || res.department === selectedDept;
    return matchesSearch && matchesDept;
  });

  return (
    <section id="results" className="py-6 px-4 bg-white border-t border-slate-200">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Title */}
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-300">
          <div className="w-9 h-9 rounded-lg bg-[#008BC5] text-white flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#0F172A]">Tra cứu kết quả thi</h2>
            <p className="text-sm text-[#334155]">Nhập mã nhân viên hoặc chọn đơn vị để kiểm tra lượt thi</p>
          </div>
        </div>

        {/* Filter / Search Form */}
        <div className="bg-slate-50 p-4 rounded-[10px] border border-slate-200 shadow-z176 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-[#0F172A] mb-1">
                Tìm theo Mã NV hoặc Họ tên:
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ví dụ: NV17601 hoặc Nguyễn Văn An"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full min-h-[48px] pl-10 pr-3 bg-white border border-slate-300 rounded-lg text-base text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#008BC5]"
                />
                <Search className="w-5 h-5 text-slate-400 absolute left-3 top-3.5" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#0F172A] mb-1">
                Chọn Xưởng / Phòng ban:
              </label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full min-h-[48px] px-3 bg-white border border-slate-300 rounded-lg text-base text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#008BC5]"
              >
                <option value="Tất cả">Tất cả đơn vị trong Z176</option>
                {Z176_COMPANY_INFO.departments.map((dept, i) => (
                  <option key={i} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Results Table / Cards */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm font-semibold text-[#334155] px-1">
            <span>Danh sách lượt thi ({filteredResults.length} kết quả)</span>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedDept('Tất cả');
              }}
              className="flex items-center gap-1 text-[#008BC5] hover:underline min-touch-target"
            >
              <RefreshCw className="w-4 h-4" /> Đặt lại
            </button>
          </div>

          {filteredResults.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-[10px] p-6 text-center text-[#334155]">
              Không tìm thấy kết quả phù hợp. Vui lòng kiểm tra lại Mã nhân viên.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredResults.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200 rounded-[10px] p-4 shadow-z176 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-[#0F172A]">{item.fullName}</span>
                      <span className="bg-slate-100 text-[#334155] text-xs px-2 py-0.5 rounded font-mono font-bold">
                        {item.employeeId}
                      </span>
                    </div>
                    <div className="text-sm text-[#334155]">
                      {item.department} • <span className="text-slate-500">{item.completedAt}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="text-left sm:text-right">
                      <span className="text-xs text-slate-500 block">Điểm bài thi</span>
                      <span className="text-lg font-bold text-[#0F172A]">
                        {item.score}/{item.totalQuestions} câu
                      </span>
                    </div>

                    <div>
                      {item.passed ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 border border-green-200 text-[#22C55E] font-bold text-sm">
                          <CheckCircle2 className="w-4 h-4" /> ĐẠT
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-[#E53E3E] font-bold text-sm">
                          <XCircle className="w-4 h-4" /> CHƯA ĐẠT
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
