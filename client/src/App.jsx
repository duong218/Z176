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

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isExamOpen, setIsExamOpen] = useState(false);

  // ── Auth state ─────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

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

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    // Admin đăng nhập thành công -> tự động chuyển sang Dashboard,
    // không cần bấm thêm vào nút "Dashboard" trên Header.
    if (user?.roleCode === 'admin') {
      setActiveTab('admin-dashboard');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null);
    // Đăng xuất khỏi dashboard thì về lại trang chủ, tránh màn hình trắng
    // do activeTab vẫn là 'admin-dashboard' nhưng currentUser đã null.
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
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onOpenLogin={() => setIsLoginOpen(true)}
        onOpenExam={handleOpenExam}
        unitLogo={unitLogo}
        currentUser={currentUser}
        authLoading={authLoading}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {activeTab === 'admin-dashboard' && currentUser?.roleCode === 'admin' ? (
          <AdminDashboard currentUser={currentUser} />
        ) : (
          <>
            {/* 2. Banner giới thiệu cuộc thi */}
            <section
              className="relative overflow-hidden bg-cover bg-[center_55%]"
              style={{ backgroundImage: 'url(/images/HeroSection.jpg)' }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(15,23,42,0.72)_0%,rgba(15,23,42,0.48)_52%,rgba(15,23,42,0.20)_100%)] pointer-events-none" />
              <div className="relative z-10">
                <Banner unitLogo={unitLogo} />
                <TimeAndCountdown />
                <CTAButton onClick={handleOpenExam} />
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
    </div>
  );
}