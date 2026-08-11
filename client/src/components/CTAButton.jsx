import { PlayCircle, ArrowRight } from 'lucide-react';

export const CTAButton = ({ onClick }) => {
  return (
    <div className="py-2.5 sm:py-4 px-4">
      <div className="max-w-md mx-auto">
        {/*
          CTA Button "VÀO THI":
          - EXCEPTION ONLY: Pill border radius (rounded-full / 999px)
          - Flat blue #008BC5 (NO RED)
          - White text, 18px, weight 700
          - Full-width on mobile, minimum height 52px
        */}
        <button
          onClick={onClick}
          className="w-full min-h-[52px] bg-[#008BC5] hover:bg-[#0077A8] active:scale-95 text-white font-bold text-[18px] sm:text-[20px] rounded-[999px] shadow-lg shadow-[#008BC5]/20 flex items-center justify-center gap-3 px-8 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-[#008BC5]/30 cursor-pointer min-touch-target"
          aria-label="Nhấn để bắt đầu vào thi trực tuyến"
        >
          <PlayCircle className="w-6 h-6 shrink-0" />
          <span>VÀO THI NGAY</span>
          <ArrowRight className="w-5 h-5 shrink-0" />
        </button>
        <p className="text-center text-xs text-slate-100 mt-1.5 font-medium drop-shadow-[0_2px_5px_rgba(0,0,0,0.9)]">
          Dành cho cán bộ, công nhân viên Công ty Z176 
        </p>
      </div>
    </div>
  );
};
