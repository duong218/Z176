import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, User, Lock, CheckCircle2, AlertCircle, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { loginUser } from '../services/auth.service';
import { useScrollLock } from '../hooks/useScrollLock';

export const LoginModal = ({ isOpen, onClose, onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  const usernameRef = useRef(null);
  const errorRef = useRef(null);

  useScrollLock(isOpen);

  // Autofocus username field whenever the modal opens, and reset transient state.
  useEffect(() => {
    if (isOpen) {
      setErrorMessage('');
      setShowPassword(false);
      const t = setTimeout(() => usernameRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Move focus to the error banner when a new error appears, for screen readers / keyboard users.
  useEffect(() => {
    if (errorMessage) errorRef.current?.focus();
  }, [errorMessage]);

  const handleKeyUp = (e) => {
    if (typeof e.getModifierState === 'function') {
      setCapsLockOn(e.getModifierState('CapsLock'));
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isLoading) onClose();
  };

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
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={handleBackdropClick}
          role="presentation"
        >
          <motion.div
            className="bg-white w-full max-w-md rounded-[10px] shadow-2xl overflow-hidden border border-slate-200"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-modal-title"
          >
            {/* Modal Header */}
            <div className="bg-[#0F172A] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#008BC5] text-white flex items-center justify-center font-bold">
                  <User className="w-5 h-5" />
                </div>
                <h3 id="login-modal-title" className="font-bold text-base text-white">
                  Đăng nhập hệ thống Z176
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg min-touch-target flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#008BC5]"
                aria-label="Đóng bảng đăng nhập"
                disabled={isLoading}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSubmit} className="p-4 space-y-4" noValidate>
              <AnimatePresence mode="wait">
                {errorMessage && (
                  <motion.div
                    key={errorMessage}
                    ref={errorRef}
                    tabIndex={-1}
                    role="alert"
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.15 }}
                    className="p-3 bg-[#FEECEC] border border-[#E53E3E]/30 rounded-lg text-[#0F172A] font-medium text-sm flex items-center gap-2 outline-none"
                  >
                    <AlertCircle className="w-5 h-5 shrink-0 text-[#E53E3E]" />
                    <span>{errorMessage}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                <label htmlFor="login-username" className="block text-sm font-bold text-[#0F172A] mb-1">
                  Tên đăng nhập <span className="text-[#E53E3E]">*</span>
                </label>
                <div className="relative">
                  <User className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-username"
                    ref={usernameRef}
                    type="text"
                    placeholder="Nhập tên đăng nhập"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full min-h-[48px] pl-10 pr-3 bg-slate-50 border border-slate-300 rounded-lg text-base text-[#0F172A] transition-colors focus:outline-none focus:ring-2 focus:ring-[#008BC5] focus:border-[#008BC5] disabled:opacity-60"
                    required
                    disabled={isLoading}
                    autoComplete="username"
                    aria-invalid={Boolean(errorMessage)}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="login-password" className="block text-sm font-bold text-[#0F172A]">
                    Mật khẩu <span className="text-[#E53E3E]">*</span>
                  </label>
                  {capsLockOn && (
                    <span className="text-xs font-semibold text-[#E53E3E] flex items-center gap-1">
                      Caps Lock đang bật
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Nhập mật khẩu"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyUp={handleKeyUp}
                    onKeyDown={handleKeyUp}
                    className="w-full min-h-[48px] pl-10 pr-11 bg-slate-50 border border-slate-300 rounded-lg text-base text-[#0F172A] transition-colors focus:outline-none focus:ring-2 focus:ring-[#008BC5] focus:border-[#008BC5] disabled:opacity-60"
                    required
                    disabled={isLoading}
                    autoComplete="current-password"
                    aria-invalid={Boolean(errorMessage)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={isLoading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-[#0F172A] rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#008BC5] disabled:opacity-50"
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    tabIndex={0}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full min-h-[48px] bg-[#008BC5] text-white font-bold text-base rounded-[10px] hover:bg-[#007ba1] active:scale-[0.98] transition-all flex items-center justify-center gap-2 min-touch-target disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#008BC5]"
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

              <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400 pt-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Kết nối được mã hóa và bảo mật
              </p>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};