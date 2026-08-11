/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Banner } from './components/Banner';
import { TimeAndCountdown } from './components/TimeAndCountdown';
import { CTAButton } from './components/CTAButton';
import { RegulationsSection } from './components/RegulationsSection';
import { QuickGuideSection } from './components/QuickGuideSection';
import { ResultsLookupSection } from './components/ResultsLookupSection';
import { ContactSection } from './components/ContactSection';
import { Footer } from './components/Footer';
import { LoginModal } from './components/LoginModal';
import { ExamModal } from './components/ExamModal';
import { fetchMe, logoutUser, getAccessToken } from './services/auth.service';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { ExaminerDashboard } from './pages/examiner/ExaminerDashboard';
import { LeaderDashboard } from './pages/leader/LeaderDashboard';
import { CandidateDashboard } from './pages/candidate/CandidateDashboard';
import { fetchActiveExam } from './services/exam-review.service';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { AlertCircle } from 'lucide-react';

// Khoảng thời gian tự động làm mới kỳ thi đang active trên trang chủ (ms).
// Giúp Hero Section tự cập nhật khi Người duyệt đề vừa "Đăng chính thức" mà không cần F5.
const ACTIVE_EXAM_POLL_INTERVAL_MS = 60_000;

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isExamOpen, setIsExamOpen] = useState(false);

  // ── Auth state ─────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  // Auto-login: kiểm tra accessToken khi mount
  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setAuthLoading(false);
      return;
    }
    fetchMe()
      .then((user) => setCurrentUser(user))
      .catch(() => {
        /* token hết hạn hoặc lỗi — bỏ qua, user sẽ thấy nút đăng nhập */
      })
      .finally(() => setAuthLoading(false));
  }, []);

  const [activeExam, setActiveExam] = useState(null);

  // Lấy kỳ thi đang published:
  // 1) Gọi ngay khi app khởi động (giữ hành vi cũ).
  // 2) Gọi lại mỗi khi người dùng quay về tab "home" (ví dụ sau khi đăng xuất khỏi Dashboard,
  //    hoặc bấm "Trang chủ" trên Header) — tránh phải F5 mới thấy kỳ thi vừa được publish.
  // 3) Polling định kỳ trong lúc đang ở trang chủ, để các tab đang mở sẵn cũng tự cập nhật.
  useEffect(() => {
    let cancelled = false;

    const loadActiveExam = () => {
      fetchActiveExam().then((data) => {
        if (!cancelled) setActiveExam(data);
      });
    };

    loadActiveExam();

    if (activeTab !== 'home') {
      return () => {
        cancelled = true;
      };
    }

    const intervalId = setInterval(loadActiveExam, ACTIVE_EXAM_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [activeTab]);

  // Tự động mở modal đổi mật khẩu nếu bắt buộc
  useEffect(() => {
    if (currentUser?.mustChangePassword && (activeTab === 'admin-dashboard' || activeTab === 'examiner-dashboard' || activeTab === 'leader-dashboard' || activeTab === 'candidate-dashboard')) {
      setIsChangePasswordOpen(true);
    }
  }, [currentUser, activeTab]);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    // Admin đăng nhập thành công -> tự động chuyển sang Dashboard,
    // không cần bấm thêm vào nút "Dashboard" trên Header.
    if (user?.roleCode === 'admin') {
      setActiveTab('admin-dashboard');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (user?.roleCode === 'examiner') {
      setActiveTab('examiner-dashboard');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (user?.roleCode === 'leader') {
      setActiveTab('leader-dashboard');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (user?.roleCode === 'candidate') {
      setActiveTab('candidate-dashboard');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null);
    // Đăng xuất khỏi dashboard thì về lại trang chủ, tránh màn hình trắng
    // do activeTab vẫn là 'admin-dashboard'/'examiner-dashboard' nhưng currentUser đã null.
    setActiveTab('home');
  };

  // ── Unit Logo (localStorage) ───────────────────────────────
  const [unitLogo] = useState(() => {
    try {
      const saved = localStorage.getItem('z176_unit_logo_v2');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error reading saved logo:', e);
    }
    return {
      type: 'preset',
      presetId: 'defense_star',
      title: 'Huy hiệu Quốc phòng Z176',
    };
  });

  // ── Navigation ─────────────────────────────────────────────
  const handleSelectTab = (tab) => {
    setActiveTab(tab);
    if (tab !== 'home') {
      const element = document.getElementById(tab);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleOpenExam = () => {
    setIsExamOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-[#0F172A] antialiased selection:bg-[#008BC5] selection:text-white">
      {/* 1. Header (Navbar) fixed top */}
      <Header
        variant={activeTab.endsWith('-dashboard') ? 'dashboard' : 'public'}
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onOpenLogin={() => setIsLoginOpen(true)}
        onOpenExam={handleOpenExam}
        onOpenChangePassword={() => setIsChangePasswordOpen(true)}
        unitLogo={unitLogo}
        currentUser={currentUser}
        authLoading={authLoading}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {currentUser?.mustChangePassword && (
          <div className="max-w-6xl mx-auto px-4 mt-20 -mb-12">
            <div className="p-4 bg-orange-50 border border-orange-200 text-orange-800 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-base">Yêu cầu đổi mật khẩu!</p>
                  <p className="text-sm text-orange-700 font-medium">Tài khoản của bạn đang dùng mật khẩu tạm thời. Vui lòng đổi mật khẩu mới để bảo mật và mở khóa đầy đủ chức năng hệ thống.</p>
                </div>
              </div>
              <button
                onClick={() => setIsChangePasswordOpen(true)}
                className="px-4 py-2 bg-[#F6AD37] hover:bg-orange-500 text-white rounded-lg text-sm font-semibold shrink-0 transition-colors shadow-sm"
              >
                Đổi mật khẩu ngay
              </button>
            </div>
          </div>
        )}

        {activeTab === 'admin-dashboard' && currentUser?.roleCode === 'admin' ? (
          <AdminDashboard currentUser={currentUser} />
        ) : activeTab === 'examiner-dashboard' && currentUser?.roleCode === 'examiner' ? (
          <ExaminerDashboard />
        ) : activeTab === 'leader-dashboard' && currentUser?.roleCode === 'leader' ? (
          <LeaderDashboard onLogout={handleLogout} />
        ) : activeTab === 'candidate-dashboard' && currentUser?.roleCode === 'candidate' ? (
          <CandidateDashboard currentUser={currentUser} onOpenExam={handleOpenExam} />
        ) : (
          <>
            {/* 2. Banner giới thiệu cuộc thi */}
            <section
              className="relative overflow-hidden bg-cover bg-[center_55%]"
              style={{ backgroundImage: 'url(/images/HeroSection.jpg)' }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(15,23,42,0.72)_0%,rgba(15,23,42,0.48)_52%,rgba(15,23,42,0.20)_100%)] pointer-events-none" />
              <div className="relative z-10">
                <Banner unitLogo={unitLogo} activeExam={activeExam} />
                <TimeAndCountdown activeExam={activeExam} />
                <CTAButton onClick={handleOpenExam} activeExam={activeExam} />
              </div>
            </section>

            {/* Quy chế & Thể lệ */}
            <RegulationsSection onStartExam={handleOpenExam} />

            {/* Hướng dẫn nhanh cho công nhân */}
            <QuickGuideSection onStartExam={handleOpenExam} />

            {/* Tra cứu kết quả thi */}
            <ResultsLookupSection />

            {/* Liên hệ & Hỗ trợ kỹ thuật */}
            <ContactSection />
          </>
        )}
      </main>

      {/* Footer */}
      <Footer />

      {/* Modals */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      <ExamModal
        isOpen={isExamOpen}
        onClose={() => setIsExamOpen(false)}
        currentUser={currentUser}
        onOpenLogin={() => {
          setIsExamOpen(false);
          setIsLoginOpen(true);
        }}
      />

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
        username={currentUser?.username}
        onPasswordChanged={(updatedUser) => setCurrentUser(updatedUser)}
        preventClose={currentUser?.mustChangePassword === true}
      />
    </div>
  );
}