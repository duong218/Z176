import { useState } from 'react';
import { Home, FileText, Award, CheckSquare, PhoneCall, User, Menu, X } from 'lucide-react';
import { UnitLogoDisplay } from './UnitLogoDisplay';

export const Header = ({
  activeTab,
  onSelectTab,
  onOpenLogin,
  onOpenExam,
  unitLogo,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const menuItems = [
    { id: 'home', label: 'Trang chủ', icon: <Home className="w-5 h-5 shrink-0" /> },
    { id: 'rules', label: 'Quy chế', icon: <FileText className="w-5 h-5 shrink-0" /> },
    { id: 'results', label: 'Kết quả', icon: <Award className="w-5 h-5 shrink-0" /> },
    { id: 'exam', label: 'Vào thi', icon: <CheckSquare className="w-5 h-5 shrink-0" /> },
    { id: 'contact', label: 'Liên hệ', icon: <PhoneCall className="w-5 h-5 shrink-0" /> },
  ];

  const handleNavClick = (tab) => {
    if (tab === 'exam') {
      onOpenExam();
    } else {
      onSelectTab(tab);
    }
    setDrawerOpen(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0F172A] text-white shadow-z176 border-b border-[#334155]/40">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo Z176 */}
        <button
          onClick={() => handleNavClick('home')}
          className="flex items-center gap-2.5 text-left focus:outline-none focus:ring-2 focus:ring-[#008BC5] rounded-md p-1 -ml-1 transition-colors"
          aria-label="Về trang chủ Z176"
        >
          <UnitLogoDisplay config={unitLogo} sizeClassName="w-10 h-10" iconSizeClassName="w-6 h-6" />
          <div className="flex flex-col">
            <span className="font-bold text-base leading-tight tracking-wide text-white">
              Z176 - BỘ QUỐC PHÒNG
            </span>
            <span className="text-xs text-[#64748B] font-medium leading-tight">
              Hệ thống thi nội bộ
            </span>
          </div>
        </button>

        {/* Desktop Navigation Menu */}
        <nav className="hidden md:flex items-center gap-2 xl:gap-5" aria-label="Menu chính">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`flex items-center gap-1.5 px-3 py-2 lg:px-5 rounded-lg font-medium text-sm lg:text-base transition-all duration-200 whitespace-nowrap min-touch-target ${
                  isActive
                    ? 'bg-[#008BC5]/15 text-[#38BDF8] border border-[#008BC5]/30 font-semibold shadow-[0_0_12px_rgba(56,189,248,0.15)]'
                    : 'text-slate-300 hover:text-white hover:bg-[#334155]/40 border border-transparent'
                }`}
              >
                <span className="hidden lg:inline-block">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Desktop Login Button */}
        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={onOpenLogin}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium text-base rounded-lg transition-all duration-200 border border-slate-700 hover:border-slate-600 whitespace-nowrap shadow-sm hover:shadow-md min-touch-target"
          >
            <User className="w-5 h-5 text-[#008BC5]" />
            <span>Đăng nhập / Đăng ký</span>
          </button>
        </div>

        {/* Mobile Hamburger Toggle Button (<640px) */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2.5 text-white hover:bg-[#334155] rounded-lg min-touch-target flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#008BC5]"
            aria-label="Mở danh mục menu"
          >
            <Menu className="w-7 h-7" />
          </button>
        </div>
      </div>

      {/* Mobile Drawer Slide-in */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 transition-opacity"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Content */}
          <div className="relative w-4/5 max-w-xs bg-[#0F172A] text-white h-full shadow-2xl flex flex-col z-10 border-r border-[#334155]">
            {/* Drawer Header */}
            <div className="p-4 border-b border-[#334155] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#008BC5] text-white flex items-center justify-center font-bold">
                  Z
                </div>
                <span className="font-bold text-base text-white">Menu hệ thống Z176</span>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-2 text-gray-300 hover:text-white rounded-lg min-touch-target flex items-center justify-center"
                aria-label="Đóng menu"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Menu Items strictly in order */}
            <div className="p-4 flex-1 overflow-y-auto space-y-2">
              {menuItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-lg text-left text-base font-medium transition-colors min-touch-target ${
                      isActive
                        ? 'bg-[#008BC5] text-white font-bold'
                        : 'text-gray-100 hover:bg-[#334155] active:bg-[#334155]'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}

              <div className="pt-4 border-t border-[#334155] space-y-2">
                <button
                  onClick={() => {
                    setDrawerOpen(false);
                    onOpenLogin();
                  }}
                  className="w-full flex items-center justify-center gap-2.5 px-4 py-3 bg-[#334155] hover:bg-[#334155]/80 text-white font-semibold text-base rounded-lg transition-colors min-touch-target border border-gray-600/40"
                >
                  <User className="w-5 h-5 text-[#008BC5]" />
                  <span>Đăng nhập / Đăng ký</span>
                </button>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-[#334155] bg-[#0F172A] text-xs text-[#64748B] text-center">
              Công ty Z176 - Bộ Quốc phòng
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
