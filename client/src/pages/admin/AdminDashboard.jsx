import { useState } from 'react';
import { OverviewTab } from '../../components/admin/OverviewTab';
import { AccountTab } from '../../components/admin/AccountTab';
import { AuditLogTab } from '../../components/admin/AuditLogTab';
import { LayoutDashboard, Users, Activity } from 'lucide-react';

export const AdminDashboard = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: 'Tổng quan', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'accounts', label: 'Tài khoản', icon: <Users className="w-5 h-5" /> },
    { id: 'audit', label: 'Nhật ký (Log)', icon: <Activity className="w-5 h-5" /> },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 mt-16 min-h-screen">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-[#0F172A] mb-2">BẢNG ĐIỀU KHIỂN QUẢN TRỊ</h1>
        <p className="text-slate-500">Quản lý người dùng và theo dõi hoạt động hệ thống Z176.</p>
      </div>

      <div className="bg-white rounded-xl shadow-z176 border border-slate-200 overflow-hidden">
        {/* Tab Navigation */}
        <div className="flex overflow-x-auto border-b border-slate-200 bg-slate-50 scrollbar-hide">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 font-medium text-sm whitespace-nowrap transition-colors border-b-2 outline-none focus:bg-slate-100 ${
                activeTab === tab.id
                  ? 'border-[#008BC5] text-[#008BC5] bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-4 md:p-6 bg-slate-50/50 min-h-[400px]">
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'accounts' && <AccountTab currentUser={currentUser} />}
          {activeTab === 'audit' && <AuditLogTab />}
        </div>
      </div>
    </div>
  );
};
