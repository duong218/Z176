import { useState } from 'react';
import { X, User, Lock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { loginUser } from '../services/auth.service';
import { useScrollLock } from '../hooks/useScrollLock';

export const LoginModal = ({ isOpen, onClose, onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useScrollLock(isOpen);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!username.trim()) {
      setErrorMessage('Vui lòng nhập tên đăng nhập');
      return;
    }
    if (!password) {
      setErrorMessage('Vui lòng nhập mật khẩu');
      return;
    }

    setErrorMessage('');
    setIsLoading(true);

    try {
      const data = await loginUser(username.trim(), password);
      onLoginSuccess(data.user);
      onClose();
      // Reset form
      setUsername('');
      setPassword('');
    } catch (err) {
      setErrorMessage(err.message || 'Đăng nhập thất bại. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
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
            <h3 className="font-bold text-base text-white">Đăng nhập hệ thống Z176</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-300 hover:text-white rounded-lg min-touch-target flex items-center justify-center"
            aria-label="Đóng bảng đăng nhập"
            disabled={isLoading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-[#FEECEC] border border-[#E53E3E]/30 rounded-lg text-[#0F172A] font-medium text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-[#0F172A] mb-1">
              Tên đăng nhập <span className="text-[#E53E3E]">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Nhập tên đăng nhập"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full min-h-[48px] pl-10 pr-3 bg-slate-50 border border-slate-300 rounded-lg text-base text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#008BC5]"
                required
                disabled={isLoading}
                autoComplete="username"
              />
              <User className="w-5 h-5 text-slate-400 absolute left-3 top-3.5" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-[#0F172A] mb-1">
              Mật khẩu <span className="text-[#E53E3E]">*</span>
            </label>
            <div className="relative">
              <input
                type="password"
                placeholder="Nhập mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full min-h-[48px] pl-10 pr-3 bg-slate-50 border border-slate-300 rounded-lg text-base text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#008BC5]"
                required
                disabled={isLoading}
                autoComplete="current-password"
              />
              <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-3.5" />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full min-h-[48px] bg-[#008BC5] text-white font-bold text-base rounded-[10px] hover:bg-[#007ba1] transition-colors flex items-center justify-center gap-2 min-touch-target disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Đang xác thực...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>ĐĂNG NHẬP</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};