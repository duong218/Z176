/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
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


export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isExamOpen, setIsExamOpen] = useState(false);


  // Unit Logo state with localStorage persistence
  const [unitLogo, setUnitLogo] = useState(() => {
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

  const handleSaveLogo = (newLogo) => {
    setUnitLogo(newLogo);
    try {
      localStorage.setItem('z176_unit_logo_v2', JSON.stringify(newLogo));
    } catch (e) {
      console.error('Error saving logo:', e);
    }
  };

  const [currentUser, setCurrentUser] = useState({
    employeeId: 'NV17601',
    fullName: 'Nguyễn Văn An',
    department: 'Xưởng Dệt may 1',
    role: 'Công nhân',
  });

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
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {/* 2. Banner giới thiệu cuộc thi */}
        <section
          className="relative overflow-hidden bg-cover bg-[center_55%]"
          style={{ backgroundImage: 'url(/images/HeroSection.jpg)' }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(15,23,42,0.72)_0%,rgba(15,23,42,0.48)_52%,rgba(15,23,42,0.20)_100%)] pointer-events-none" />
          <div className="relative z-10">
        <Banner
          unitLogo={unitLogo}
        />

        {/* 3. Thông tin thời gian thi & 4. Khối đếm ngược (4 ô: Ngày/Giờ/Phút/Giây) */}
        <TimeAndCountdown />

        {/* 5. Nút CTA "VÀO THI" (Pill 999px exception, flat blue #008BC5, above the fold) */}
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
      </main>

      {/* Footer */}
      <Footer />

      {/* Modals */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
        }}
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
