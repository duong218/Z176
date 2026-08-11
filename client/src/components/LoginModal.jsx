import { useState } from 'react';
import { X, User, Lock, Building, CheckCircle2, AlertCircle } from 'lucide-react';
import { Z176_COMPANY_INFO } from '../data';
export const LoginModal = ({ isOpen, onClose, onLoginSuccess }) => {
  const [employeeId, setEmployeeId] = useState('');
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState(Z176_COMPANY_INFO.departments[0]);
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!employeeId.trim()) {
      setErrorMessage('Vui lòng nhập Mã nhân viên (ví dụ: NV17601)');
      return;
    }
    if (!fullName.trim()) {
      setErrorMessage('Vui lòng nhập đầy đủ Họ và tên');
      return;
    }

    setErrorMessage('');
    const user = {
      employeeId: employeeId.trim().toUpperCase(),
      fullName: fullName.trim(),
      department,
      role: 'Công nhân / Cán bộ',
    };

    onLoginSuccess(user);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-md rounded-[10px] shadow-2xl overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="bg-[#0F172A] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#008BC5] text-white flex items-center justify-center font-bold">
              <User className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-white">Đăng nhập / Đăng ký thi Z176</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-300 hover:text-white rounded-lg min-touch-target flex items-center justify-center"
            aria-label="Đóng bảng đăng nhập"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-[#E53E3E] font-medium text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-[#0F172A] mb-1">
              Mã nhân viên (in trên Thẻ công nhân) <span className="text-[#E53E3E]">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Nhập mã NV, VD: NV17601"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full min-h-[48px] pl-10 pr-3 bg-slate-50 border border-slate-300 rounded-lg text-base text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#008BC5]"
                required
              />
              <User className="w-5 h-5 text-slate-400 absolute left-3 top-3.5" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-[#0F172A] mb-1">
              Họ và tên công nhân / cán bộ <span className="text-[#E53E3E]">*</span>
            </label>
            <input
              type="text"
              placeholder="Nhập đầy đủ Họ và tên"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full min-h-[48px] px-3 bg-slate-50 border border-slate-300 rounded-lg text-base text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#008BC5]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-[#0F172A] mb-1">
              Xưởng / Phòng ban trực thuộc <span className="text-[#E53E3E]">*</span>
            </label>
            <div className="relative">
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full min-h-[48px] pl-10 pr-3 bg-slate-50 border border-slate-300 rounded-lg text-base text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#008BC5]"
              >
                {Z176_COMPANY_INFO.departments.map((dept, i) => (
                  <option key={i} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
              <Building className="w-5 h-5 text-slate-400 absolute left-3 top-3.5" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-[#0F172A] mb-1">
              Mật khẩu (hoặc 4 số cuối CMND/CCCD)
            </label>
            <div className="relative">
              <input
                type="password"
                placeholder="Mật khẩu tài khoản"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full min-h-[48px] pl-10 pr-3 bg-slate-50 border border-slate-300 rounded-lg text-base text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#008BC5]"
              />
              <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-3.5" />
            </div>
            <span className="text-xs text-slate-500 mt-1 block">
              Mặc định là 4 số cuối CCCD nếu bạn chưa đổi mật khẩu.
            </span>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full min-h-[48px] bg-[#008BC5] text-white font-bold text-base rounded-[10px] hover:bg-[#007ba1] transition-colors flex items-center justify-center gap-2 min-touch-target"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>XÁC NHẬN ĐĂNG NHẬP</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
