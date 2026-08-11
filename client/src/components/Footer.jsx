import { Z176_COMPANY_INFO } from '../data';
import { ShieldCheck, PhoneCall, Mail } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="bg-[#0F172A] text-white py-6 px-4 border-t border-[#334155]/60">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#008BC5] text-white flex items-center justify-center font-bold shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-base text-white">{Z176_COMPANY_INFO.name}</div>
              <div className="text-xs text-[#64748B]">Doanh nghiệp sản xuất thuộc Bộ Quốc phòng</div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-300">
            <a href={`tel:${Z176_COMPANY_INFO.supportHotline}`} className="flex items-center gap-1.5 hover:text-[#008BC5]">
              <PhoneCall className="w-4 h-4 text-[#008BC5]" /> {Z176_COMPANY_INFO.supportHotline}
            </a>
            <a href={`mailto:${Z176_COMPANY_INFO.supportEmail}`} className="flex items-center gap-1.5 hover:text-[#008BC5]">
              <Mail className="w-4 h-4 text-[#008BC5]" /> {Z176_COMPANY_INFO.supportEmail}
            </a>
          </div>
        </div>

        <div className="pt-3 border-t border-[#334155]/40 text-center text-xs text-[#64748B]">
          © 2026 {Z176_COMPANY_INFO.shortName} — Hệ thống thi trực tuyến nội bộ. Bản quyền thuộc Công ty Z176 - Bộ Quốc phòng.
        </div>
      </div>
    </footer>
  );
};
